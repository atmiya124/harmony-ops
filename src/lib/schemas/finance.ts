import { z } from 'zod';
import {
  AMOUNT_STATUSES,
  EXPENSE_CATEGORIES,
  FUNDING_SOURCES,
  HST_TREATMENTS,
  MAX_AMOUNT_CENTS,
  MAX_HST_RATE_BP,
  PAYMENT_METHODS,
  REIMBURSEMENT_METHODS,
} from '../finance/types';
import { defaultFundingSource, defaultReimbursable, isValidReimbursable } from '../finance/reimbursement';

// Server-side validation for financial writes. The database repeats the
// critical rules as CHECK constraints; these schemas turn bad input into a
// clear 400 before it gets that far. Checks that need server context — is
// the booking real, is "paid by" one of the partners — happen in the route.

export const EARLIEST_EXPENSE_DATE = '2025-01-01'; // Harmony Production began operating in 2025

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const cents = (max: number) => z.number().int('Amount must be in whole cents').min(0).max(max);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .nullish()
    .transform((v) => (v ? v : null));

const positiveCents = z
  .number('Enter an amount')
  .int('Amount must be in whole cents')
  .min(1, 'Amount must be more than $0')
  .max(MAX_AMOUNT_CENTS, "Amount can't exceed $1,000,000");

// A past-or-today calendar date. `today` is the server's date (YYYY-MM-DD);
// one day of slack allows for a phone in a timezone ahead of the server.
const pastDate = (today: string) =>
  z
    .string('Enter a date')
    .refine(isCalendarDate, { message: 'Enter a valid date', abort: true })
    .refine((v) => v >= EARLIEST_EXPENSE_DATE, { message: `Date can't be before ${EARLIEST_EXPENSE_DATE}`, abort: true })
    .refine((v) => v <= addDaysIso(today, 1), "Date can't be in the future");

const expenseFields = (today: string) => ({
  bookingId: z.number().int().positive().nullable(),
  category: z.enum(EXPENSE_CATEGORIES, 'Choose a category'),
  amountCents: positiveCents,
  taxCents: cents(MAX_AMOUNT_CENTS).default(0),
  expenseDate: pastDate(today),
  paidByEmail: z.string().trim().toLowerCase().pipe(z.email('Choose who paid')),
  paymentMethod: z.enum(PAYMENT_METHODS, 'Choose a payment method'),
  // Optional on input: derived from the payment method / funding source
  // when omitted, so the quick-entry form can leave them out.
  fundingSource: z.enum(FUNDING_SOURCES).optional(),
  reimbursable: z.boolean().optional(),
  notes: optionalText(1000),
  receiptAttachmentId: z.uuid().nullish().transform((v) => v ?? null),
});

// Fills in the derived defaults and checks the cross-field rules.
function finalizeExpense<T extends z.ZodObject<ReturnType<typeof expenseFields>>>(object: T) {
  return object
    .transform((v) => {
      const fundingSource = v.fundingSource ?? defaultFundingSource(v.paymentMethod);
      const reimbursable = v.reimbursable ?? defaultReimbursable(fundingSource);
      return { ...v, fundingSource, reimbursable };
    })
    .superRefine((v, ctx) => {
      if (v.taxCents >= v.amountCents) {
        ctx.addIssue({ code: 'custom', path: ['taxCents'], message: 'HST must be less than the total amount' });
      }
      if (!isValidReimbursable(v.fundingSource, v.reimbursable)) {
        ctx.addIssue({ code: 'custom', path: ['reimbursable'], message: 'Company-paid expenses are never reimbursed' });
      }
    });
}

export function expenseInputSchema(today: string) {
  return finalizeExpense(z.object({ id: z.uuid('Invalid expense id'), ...expenseFields(today) }));
}
export type ExpenseInput = z.output<ReturnType<typeof expenseInputSchema>>;

// Edits replace the whole record. `expectedUpdatedAt` is the updatedAt the
// editor loaded; if another partner saved in between, the write is refused
// (409) instead of silently overwriting their change.
export function expenseUpdateSchema(today: string) {
  return finalizeExpense(z.object({ ...expenseFields(today), expectedUpdatedAt: z.string().min(1, 'Missing version') }));
}
export type ExpenseUpdate = z.output<ReturnType<typeof expenseUpdateSchema>>;

export function reimbursementInputSchema(today: string) {
  return z.object({
    id: z.uuid('Invalid reimbursement id'),
    amountCents: positiveCents,
    reimbursedOn: pastDate(today),
    method: z.enum(REIMBURSEMENT_METHODS, 'Choose how it was paid'),
    notes: optionalText(500),
  });
}
export type ReimbursementInput = z.output<ReturnType<typeof reimbursementInputSchema>>;

export const voidInputSchema = z.object({
  reason: z.string('Give a reason').trim().min(3, 'Give a short reason').max(500, 'Keep it under 500 characters'),
});

export const eventFinancialsInputSchema = z.object({
  agreedAmountCents: cents(MAX_AMOUNT_CENTS),
  amountStatus: z.enum(AMOUNT_STATUSES, 'Choose Estimated or Confirmed'),
  hstTreatment: z.enum(HST_TREATMENTS, 'Choose how HST applies'),
  // Omitted -> the route uses the current default rate from finance settings.
  hstRateBp: z.number().int().min(0).max(MAX_HST_RATE_BP).optional(),
  notes: optionalText(2000),
});
export type EventFinancialsInput = z.output<typeof eventFinancialsInputSchema>;

export const financeSettingsInputSchema = z.object({
  hstRegistered: z.boolean(),
  defaultHstRateBp: z.number().int().min(0).max(MAX_HST_RATE_BP),
});
export type FinanceSettingsInput = z.output<typeof financeSettingsInputSchema>;
