// The one place quote and invoice totals are worked out. The builder runs it
// for the live preview and the server runs it again on every save, ignoring
// any totals the browser sent. Integer cents and basis points throughout,
// with one explicit rounding rule (half-up to the cent), so the same input
// always gives the same figures.
//
//   line items (quantity × price, less any item discount) -> subtotal
//     -> quote discount -> tax (on the discounted amount) -> total
//     -> deposit required (a share of the total)

import { hstOnTop } from './finance/tax';
import type { AdjustmentType } from './sales/types';

export interface QuoteLineInput {
  quantity: number; // whole units
  unitPriceCents: number;
  discount?: Adjustment; // off this line only; none when omitted
}

export interface Adjustment {
  type: AdjustmentType;
  value: number; // basis points for `percent`, cents for `fixed`, 0 for `none`
}

export interface QuoteCalculationInput {
  items: QuoteLineInput[];
  discount: Adjustment;
  taxRateBp: number;
  deposit: Adjustment;
}

export interface QuoteTotals {
  // Per line, in the same order as `items`: quantity × price, the line's
  // own discount, and what's left.
  lineTotalsCents: number[];
  lineDiscountsCents: number[];
  lineNetCents: number[];
  itemDiscountsCents: number; // all line discounts together
  subtotalCents: number; // sum of the lines after their discounts
  discountCents: number;
  taxableCents: number; // subtotal less discount — what tax is charged on
  taxCents: number;
  totalCents: number;
  depositRequiredCents: number;
}

const NO_ADJUSTMENT: Adjustment = { type: 'none', value: 0 };

function assertNonNegativeInt(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
}

export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  assertNonNegativeInt(quantity, 'quantity');
  assertNonNegativeInt(unitPriceCents, 'unitPriceCents');
  const total = quantity * unitPriceCents;
  if (!Number.isSafeInteger(total)) throw new RangeError('line total is too large');
  return total;
}

// A share of `baseCents`: a percentage (rounded half-up to the cent) or a
// fixed amount, never more than the base itself.
export function adjustmentCents(baseCents: number, adjustment: Adjustment): number {
  assertNonNegativeInt(baseCents, 'baseCents');
  assertNonNegativeInt(adjustment.value, 'adjustment value');
  switch (adjustment.type) {
    case 'none':
      return 0;
    case 'percent':
      return Math.min(hstOnTop(baseCents, adjustment.value), baseCents);
    case 'fixed':
      return Math.min(adjustment.value, baseCents);
  }
}

export function calculateQuoteTotals(input: QuoteCalculationInput): QuoteTotals {
  assertNonNegativeInt(input.taxRateBp, 'taxRateBp');
  const lineTotalsCents = input.items.map((i) => lineTotalCents(i.quantity, i.unitPriceCents));
  const lineDiscountsCents = input.items.map((i, n) => adjustmentCents(lineTotalsCents[n], i.discount ?? NO_ADJUSTMENT));
  const lineNetCents = lineTotalsCents.map((t, n) => t - lineDiscountsCents[n]);
  const itemDiscountsCents = lineDiscountsCents.reduce((sum, d) => sum + d, 0);
  const subtotalCents = lineNetCents.reduce((sum, t) => sum + t, 0);
  const discountCents = adjustmentCents(subtotalCents, input.discount);
  const taxableCents = subtotalCents - discountCents;
  const taxCents = hstOnTop(taxableCents, input.taxRateBp);
  const totalCents = taxableCents + taxCents;
  const depositRequiredCents = adjustmentCents(totalCents, input.deposit);
  return { lineTotalsCents, lineDiscountsCents, lineNetCents, itemDiscountsCents, subtotalCents, discountCents, taxableCents, taxCents, totalCents, depositRequiredCents };
}
