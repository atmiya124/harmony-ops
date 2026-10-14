import { z } from 'zod';
import { MAX_AMOUNT_CENTS, MAX_HST_RATE_BP } from '../finance/types';
import { ADJUSTMENT_TYPES, type AdjustmentType, effectiveTaxRateBp, MAX_ITEM_QUANTITY, MAX_PERCENT_BP, MAX_QUOTE_ITEMS, MANUAL_QUOTE_STATUSES, QUOTE_PAYMENT_METHODS, QUOTE_STATUSES, type QuoteStatus } from '../sales/types';
import { calculateQuoteTotals } from '../quoteCalculator';
import { isCalendarDate } from './finance';

// Server-side validation for quote writes. Only the inputs are accepted:
// totals, line totals, the quote number and the status are never read from
// the request — unknown keys are dropped, and the server recalculates every
// figure with quoteCalculator before anything is stored.

const requiredText = (max: number, message: string) => z.string(message).trim().min(1, message).max(max, `Keep it under ${max} characters`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .nullish()
    .transform((v) => (v ? v : null));

const calendarDate = z.string('Enter a date').refine(isCalendarDate, 'Enter a valid date');

export const quoteItemInputSchema = z.object({
  // Optional: an existing item's id keeps it stable across edits.
  id: z.uuid().optional(),
  section: requiredText(60, 'Name this section'),
  itemName: requiredText(120, 'Enter an item name'),
  description: optionalText(500),
  quantity: z.number('Enter a quantity').int('Quantity must be a whole number').min(1, 'At least 1').max(MAX_ITEM_QUANTITY, `At most ${MAX_ITEM_QUANTITY}`),
  unitPriceCents: z.number('Enter a price').int('Price must be in whole cents').min(0, "Price can't be negative").max(MAX_AMOUNT_CENTS, "Price can't exceed $1,000,000"),
  // Optional discount on this line only; omitted = none.
  discountType: z.enum(ADJUSTMENT_TYPES).default('none'),
  discountValue: z.number().int().min(0).default(0),
}).superRefine((item, ctx) => {
  const issue = adjustmentIssue(item.discountType, item.discountValue, 'discount');
  if (issue) ctx.addIssue({ code: 'custom', path: ['discountValue'], message: issue });
  else if (item.discountType === 'fixed' && Number.isSafeInteger(item.quantity * item.unitPriceCents) && item.discountValue > item.quantity * item.unitPriceCents) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: "Discount can't be more than the line total" });
  }
});
export type QuoteItemInput = z.output<typeof quoteItemInputSchema>;

const quoteFields = {
  customerName: requiredText(120, 'Enter the customer name'),
  customerCompany: optionalText(120),
  customerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.email('Enter a valid email').nullable()),
  customerPhone: optionalText(40),
  billingAddress: optionalText(300),

  eventId: z.number().int().positive().nullable(),
  eventName: optionalText(160),
  eventDate: calendarDate.nullable(),
  venueName: optionalText(160),
  venueAddress: optionalText(300),

  quoteDate: calendarDate,
  validUntil: calendarDate,

  items: z.array(quoteItemInputSchema).min(1, 'Add at least one item').max(MAX_QUOTE_ITEMS, `At most ${MAX_QUOTE_ITEMS} items`),

  discountType: z.enum(ADJUSTMENT_TYPES),
  discountValue: z.number().int().min(0),
  taxLabel: requiredText(20, 'Name the tax, e.g. HST'),
  taxRateBp: z.number().int().min(0).max(MAX_HST_RATE_BP, `Tax can't be more than ${MAX_HST_RATE_BP / 100}%`),
  depositType: z.enum(ADJUSTMENT_TYPES),
  depositValue: z.number().int().min(0),

  notes: optionalText(4000),
  terms: optionalText(8000),
  // Print the payment section on the PDF. Omitted = yes.
  showPaymentDetails: z.boolean().default(true),
  // How the client will pay; omitted = not chosen. Cash = no HST.
  paymentMethod: z
    .enum(QUOTE_PAYMENT_METHODS, 'Choose a payment method')
    .nullish()
    .transform((v) => v ?? null),
};

type QuoteFieldsOutput = z.output<z.ZodObject<typeof quoteFields>>;

function adjustmentIssue(type: AdjustmentType, value: number, label: string): string | null {
  if (type === 'none') return value === 0 ? null : `No ${label} should have a value of 0`;
  if (type === 'percent') return value <= MAX_PERCENT_BP ? null : `${label[0].toUpperCase()}${label.slice(1)} can't be more than 100%`;
  return value <= MAX_AMOUNT_CENTS ? null : `${label[0].toUpperCase()}${label.slice(1)} can't exceed $1,000,000`;
}

// Cross-field rules, checked on the server's own calculation.
function refineQuote(v: QuoteFieldsOutput, ctx: z.RefinementCtx) {
  if (v.validUntil < v.quoteDate) ctx.addIssue({ code: 'custom', path: ['validUntil'], message: "Can't be before the quote date" });
  const discountIssue = adjustmentIssue(v.discountType, v.discountValue, 'discount');
  if (discountIssue) ctx.addIssue({ code: 'custom', path: ['discountValue'], message: discountIssue });
  const depositIssue = adjustmentIssue(v.depositType, v.depositValue, 'deposit');
  if (depositIssue) ctx.addIssue({ code: 'custom', path: ['depositValue'], message: depositIssue });
  if (discountIssue || depositIssue) return;

  // Zod still runs this when a field above has failed (e.g. a fractional
  // quantity); those are already reported, so skip the totals checks.
  let totals: ReturnType<typeof calculateQuoteTotals>;
  try {
    totals = calculateQuoteTotals({
      items: v.items.map((i) => ({ ...i, discount: { type: i.discountType, value: i.discountValue } })),
      discount: { type: v.discountType, value: v.discountValue },
      taxRateBp: effectiveTaxRateBp(v.paymentMethod, v.taxRateBp),
      deposit: { type: v.depositType, value: v.depositValue },
    });
  } catch {
    return;
  }
  if (totals.subtotalCents > MAX_AMOUNT_CENTS) ctx.addIssue({ code: 'custom', path: ['items'], message: "The quote can't exceed $1,000,000" });
  if (v.discountType === 'fixed' && v.discountValue > totals.subtotalCents) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: "Discount can't be more than the subtotal" });
  }
  if (v.depositType === 'fixed' && v.depositValue > totals.totalCents) {
    ctx.addIssue({ code: 'custom', path: ['depositValue'], message: "Deposit can't be more than the total" });
  }
}

export const quoteCreateSchema = z.object({ id: z.uuid('Invalid quote id'), ...quoteFields }).superRefine(refineQuote);
export type QuoteCreateInput = z.output<typeof quoteCreateSchema>;

// Edits replace the whole quote. `expectedUpdatedAt` is the version the
// editor loaded; if someone saved in between, the write is refused (409).
export const quoteUpdateSchema = z.object({ ...quoteFields, expectedUpdatedAt: z.string().min(1, 'Missing version') }).superRefine(refineQuote);
export type QuoteUpdateInput = z.output<typeof quoteUpdateSchema>;

export const quoteStatusInputSchema = z.object({
  status: z.enum(QUOTE_STATUSES).refine((s: QuoteStatus) => MANUAL_QUOTE_STATUSES.includes(s), "That status can't be set by hand"),
  expectedUpdatedAt: z.string().min(1, 'Missing version'),
});
export type QuoteStatusInput = z.output<typeof quoteStatusInputSchema>;
