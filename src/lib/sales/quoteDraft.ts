// The quote builder's editable state, and the conversions between it and
// the API. Text fields hold exactly what was typed; turning them into cents
// and basis points (and checking them) happens here, in one place.

import { calculateQuoteTotals, type QuoteTotals } from '../quoteCalculator';
import { addDays } from '../finance/dates';
import { MAX_HST_RATE_BP, MAX_AMOUNT_CENTS } from '../finance/types';
import type { QuoteDefaults } from './defaults';
import { bpToInput, parsePercentToBp, parsePriceToCents, parseQuantity, priceToInput, type Parsed } from './inputs';
import type { AdjustmentType } from './types';

export interface ItemDraft {
  key: string; // React key; stable while editing
  id?: string; // saved item id, kept across edits
  itemName: string;
  description: string;
  quantity: string;
  unitPrice: string; // dollars as typed
  discountType: AdjustmentType; // this line's own discount
  discountValue: string; // percent or dollars, per type
}

export interface SectionDraft {
  key: string;
  name: string;
  items: ItemDraft[];
}

export interface QuoteDraft {
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerPhone: string;
  billingAddress: string;
  eventId: number | null;
  eventName: string;
  eventDate: string; // '' = TBC
  venueName: string;
  venueAddress: string;
  quoteDate: string;
  validUntil: string;
  sections: SectionDraft[];
  discountType: AdjustmentType;
  discountValue: string; // percent or dollars, per type
  taxLabel: string;
  taxRate: string; // percent
  depositType: AdjustmentType;
  depositValue: string;
  notes: string;
  terms: string;
  showPaymentDetails: boolean;
}

// What the API takes (mirrors QuoteFormValues in quotesApi).
export interface QuoteValues {
  customerName: string;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  billingAddress: string | null;
  eventId: number | null;
  eventName: string | null;
  eventDate: string | null;
  venueName: string | null;
  venueAddress: string | null;
  quoteDate: string;
  validUntil: string;
  items: { id?: string; section: string; itemName: string; description: string | null; quantity: number; unitPriceCents: number; discountType: AdjustmentType; discountValue: number }[];
  discountType: AdjustmentType;
  discountValue: number;
  taxLabel: string;
  taxRateBp: number;
  depositType: AdjustmentType;
  depositValue: number;
  notes: string | null;
  terms: string | null;
  showPaymentDetails: boolean;
}

// The saved quote fields the builder starts from when editing.
export interface SavedQuote extends Omit<QuoteValues, 'items'> {
  items: { id: string; section: string; itemName: string; description: string | null; quantity: number; unitPriceCents: number; discountType: AdjustmentType; discountValue: number }[];
}

let keyCounter = 0;
export const newKey = () => `k${++keyCounter}`;

export function blankItem(): ItemDraft {
  return { key: newKey(), itemName: '', description: '', quantity: '1', unitPrice: '', discountType: 'none', discountValue: '' };
}

export function blankSection(name = ''): SectionDraft {
  return { key: newKey(), name, items: [blankItem()] };
}

export function blankDraft(defaults: QuoteDefaults, today: string): QuoteDraft {
  return {
    customerName: '',
    customerCompany: '',
    customerEmail: '',
    customerPhone: '',
    billingAddress: '',
    eventId: null,
    eventName: '',
    eventDate: '',
    venueName: '',
    venueAddress: '',
    quoteDate: today,
    validUntil: addDays(today, defaults.validityDays),
    sections: [blankSection('LED Display')],
    discountType: defaults.discountType,
    discountValue: adjustmentToInput(defaults.discountType, defaults.discountValue),
    taxLabel: defaults.taxLabel,
    taxRate: bpToInput(defaults.taxRateBp),
    depositType: defaults.depositType,
    depositValue: adjustmentToInput(defaults.depositType, defaults.depositValue),
    notes: '',
    terms: defaults.terms,
    showPaymentDetails: true,
  };
}

// Consecutive items with the same section name form one group, so the order
// the partner arranged is kept exactly.
export function groupBySection<T extends { section: string }>(items: T[]): { section: string; items: T[] }[] {
  const groups: { section: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }
  return groups;
}

export function draftFromQuote(q: SavedQuote): QuoteDraft {
  return {
    customerName: q.customerName,
    customerCompany: q.customerCompany ?? '',
    customerEmail: q.customerEmail ?? '',
    customerPhone: q.customerPhone ?? '',
    billingAddress: q.billingAddress ?? '',
    eventId: q.eventId,
    eventName: q.eventName ?? '',
    eventDate: q.eventDate ?? '',
    venueName: q.venueName ?? '',
    venueAddress: q.venueAddress ?? '',
    quoteDate: q.quoteDate,
    validUntil: q.validUntil,
    sections: groupBySection(q.items).map((g) => ({
      key: newKey(),
      name: g.section,
      items: g.items.map((i) => ({
        key: newKey(),
        id: i.id,
        itemName: i.itemName,
        description: i.description ?? '',
        quantity: String(i.quantity),
        unitPrice: priceToInput(i.unitPriceCents),
        discountType: i.discountType,
        discountValue: adjustmentToInput(i.discountType, i.discountValue),
      })),
    })),
    discountType: q.discountType,
    discountValue: adjustmentToInput(q.discountType, q.discountValue),
    taxLabel: q.taxLabel,
    taxRate: bpToInput(q.taxRateBp),
    depositType: q.depositType,
    depositValue: adjustmentToInput(q.depositType, q.depositValue),
    notes: q.notes ?? '',
    terms: q.terms ?? '',
    showPaymentDetails: q.showPaymentDetails,
  };
}

export function adjustmentToInput(type: AdjustmentType, value: number): string {
  if (type === 'none') return '';
  return type === 'percent' ? bpToInput(value) : priceToInput(value);
}

export function parseAdjustment(type: AdjustmentType, input: string): Parsed {
  if (type === 'none') return { ok: true, value: 0 };
  return type === 'percent' ? parsePercentToBp(input) : parsePriceToCents(input);
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

// Error keys: a field name, `section:<key>`, or `item:<key>:<field>`.
export type DraftErrors = Record<string, string>;

export interface DraftResult {
  values: QuoteValues | null; // null when something needs fixing
  errors: DraftErrors;
  // Flat item index (as sent to the API) -> item key, to place server errors.
  itemKeys: string[];
}

export function draftToValues(d: QuoteDraft): DraftResult {
  const errors: DraftErrors = {};
  const itemKeys: string[] = [];
  const items: QuoteValues['items'] = [];

  if (!d.customerName.trim()) errors.customerName = 'Enter the customer name';
  if (d.customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.customerEmail.trim())) errors.customerEmail = 'Enter a valid email';
  if (!d.quoteDate) errors.quoteDate = 'Enter a date';
  if (!d.validUntil) errors.validUntil = 'Enter a date';
  else if (d.quoteDate && d.validUntil < d.quoteDate) errors.validUntil = "Can't be before the quote date";

  for (const section of d.sections) {
    if (!section.name.trim()) errors[`section:${section.key}`] = 'Name this section';
    for (const item of section.items) {
      if (!item.itemName.trim()) errors[`item:${item.key}:itemName`] = 'Enter an item name';
      const qty = parseQuantity(item.quantity);
      if (!qty.ok) errors[`item:${item.key}:quantity`] = qty.error;
      const price = parsePriceToCents(item.unitPrice);
      if (!price.ok) errors[`item:${item.key}:unitPrice`] = item.unitPrice.trim() ? price.error : 'Enter a price';
      const itemDiscount = parseAdjustment(item.discountType, item.discountValue);
      if (!itemDiscount.ok) errors[`item:${item.key}:discountValue`] = itemDiscount.error;
      else if (item.discountType === 'fixed' && qty.ok && price.ok && itemDiscount.value > qty.value * price.value) {
        errors[`item:${item.key}:discountValue`] = "Can't be more than the line total";
      }
      itemKeys.push(item.key);
      items.push({
        ...(item.id ? { id: item.id } : {}),
        section: section.name.trim(),
        itemName: item.itemName.trim(),
        description: orNull(item.description),
        quantity: qty.ok ? qty.value : 0,
        unitPriceCents: price.ok ? price.value : 0,
        discountType: item.discountType,
        discountValue: itemDiscount.ok ? itemDiscount.value : 0,
      });
    }
  }
  if (items.length === 0) errors.items = 'Add at least one item';

  const discount = parseAdjustment(d.discountType, d.discountValue);
  if (!discount.ok) errors.discountValue = discount.error;
  const tax = parsePercentToBp(d.taxRate, MAX_HST_RATE_BP);
  if (!tax.ok) errors.taxRate = tax.error;
  if (!d.taxLabel.trim()) errors.taxLabel = 'Name the tax';
  const deposit = parseAdjustment(d.depositType, d.depositValue);
  if (!deposit.ok) errors.depositValue = deposit.error;

  if (Object.keys(errors).length === 0) {
    const totals = previewTotals(d);
    if (totals.subtotalCents > MAX_AMOUNT_CENTS) errors.items = "The quote can't exceed $1,000,000";
    if (d.discountType === 'fixed' && discount.ok && discount.value > totals.subtotalCents) errors.discountValue = "Can't be more than the subtotal";
    if (d.depositType === 'fixed' && deposit.ok && deposit.value > totals.totalCents) errors.depositValue = "Can't be more than the total";
  }
  if (Object.keys(errors).length > 0) return { values: null, errors, itemKeys };

  return {
    values: {
      customerName: d.customerName.trim(),
      customerCompany: orNull(d.customerCompany),
      customerEmail: orNull(d.customerEmail),
      customerPhone: orNull(d.customerPhone),
      billingAddress: orNull(d.billingAddress),
      eventId: d.eventId,
      eventName: orNull(d.eventName),
      eventDate: d.eventDate || null,
      venueName: orNull(d.venueName),
      venueAddress: orNull(d.venueAddress),
      quoteDate: d.quoteDate,
      validUntil: d.validUntil,
      items,
      discountType: d.discountType,
      discountValue: discount.ok ? discount.value : 0,
      taxLabel: d.taxLabel.trim(),
      taxRateBp: tax.ok ? tax.value : 0,
      depositType: d.depositType,
      depositValue: deposit.ok ? deposit.value : 0,
      notes: orNull(d.notes),
      terms: orNull(d.terms),
      showPaymentDetails: d.showPaymentDetails,
    },
    errors,
    itemKeys,
  };
}

// Live totals while typing: anything not yet valid counts as zero. The same
// calculator the server uses, so the preview matches what gets saved.
export function previewTotals(d: QuoteDraft): QuoteTotals {
  const items = d.sections.flatMap((s) =>
    s.items.map((i) => {
      const qty = parseQuantity(i.quantity);
      const price = parsePriceToCents(i.unitPrice);
      const discount = parseAdjustment(i.discountType, i.discountValue);
      return {
        quantity: qty.ok ? qty.value : 0,
        unitPriceCents: price.ok ? price.value : 0,
        discount: { type: i.discountType, value: discount.ok ? discount.value : 0 },
      };
    }),
  );
  const discount = parseAdjustment(d.discountType, d.discountValue);
  const tax = parsePercentToBp(d.taxRate, MAX_HST_RATE_BP);
  const deposit = parseAdjustment(d.depositType, d.depositValue);
  try {
    return calculateQuoteTotals({
      items,
      discount: { type: d.discountType, value: discount.ok ? discount.value : 0 },
      taxRateBp: tax.ok ? tax.value : 0,
      deposit: { type: d.depositType, value: deposit.ok ? deposit.value : 0 },
    });
  } catch {
    return calculateQuoteTotals({ items: [], discount: { type: 'none', value: 0 }, taxRateBp: 0, deposit: { type: 'none', value: 0 } });
  }
}

// Server field errors ("items.3.quantity", "customerName") -> draft keys.
export function mapServerErrors(fieldErrors: Record<string, string[]>, itemKeys: string[]): DraftErrors {
  const out: DraftErrors = {};
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const message = messages[0];
    if (!message) continue;
    const m = /^items\.(\d+)\.(\w+)$/.exec(path);
    if (m) {
      const key = itemKeys[Number(m[1])];
      const field = m[2] === 'unitPriceCents' ? 'unitPrice' : m[2];
      if (key) out[`item:${key}:${field}`] = message;
      continue;
    }
    const field = path === 'taxRateBp' ? 'taxRate' : path;
    out[field] = message;
  }
  return out;
}
