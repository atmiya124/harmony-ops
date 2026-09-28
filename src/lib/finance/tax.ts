// HST arithmetic on integer cents. Rates are basis points (1300 = 13.00%).
// Everything is exact integer math with one explicit rounding step
// (half-up to the cent), and splits always add back to the original total.

import type { HstTreatment } from './types';

// round(numerator / denominator) half-up, for non-negative integers.
function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

function assertCentsAndRate(cents: number, rateBp: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError(`cents must be a non-negative integer, got ${cents}`);
  if (!Number.isInteger(rateBp) || rateBp < 0) throw new RangeError(`rateBp must be a non-negative integer, got ${rateBp}`);
}

// HST to add on top of a pre-tax amount: $100.00 at 13% -> $13.00.
export function hstOnTop(netCents: number, rateBp: number): number {
  assertCentsAndRate(netCents, rateBp);
  return roundDiv(netCents * rateBp, 10_000);
}

// The HST already contained in a tax-inclusive total: $113.00 at 13% -> $13.00.
export function hstIncluded(totalCents: number, rateBp: number): number {
  assertCentsAndRate(totalCents, rateBp);
  return roundDiv(totalCents * rateBp, 10_000 + rateBp);
}

export interface TaxSplit {
  netCents: number; // before HST — what Harmony Production actually earns
  hstCents: number; // HST collected on behalf of the government
  grossCents: number; // what the client pays
}

// Splits an event's agreed amount according to how HST was agreed:
//   excluded — the amount is pre-tax; HST is charged on top.
//   included — the amount already contains HST.
//   exempt   — no HST at all.
// `netCents` is the figure profit is measured against: HST collected from a
// client is passed on to the government, so it is never counted as income.
export function splitAgreedAmount(agreedCents: number, treatment: HstTreatment, rateBp: number): TaxSplit {
  assertCentsAndRate(agreedCents, rateBp);
  switch (treatment) {
    case 'excluded': {
      const hstCents = hstOnTop(agreedCents, rateBp);
      return { netCents: agreedCents, hstCents, grossCents: agreedCents + hstCents };
    }
    case 'included': {
      const hstCents = hstIncluded(agreedCents, rateBp);
      return { netCents: agreedCents - hstCents, hstCents, grossCents: agreedCents };
    }
    case 'exempt':
      return { netCents: agreedCents, hstCents: 0, grossCents: agreedCents };
  }
}

// What an expense really cost the business. When Harmony Production is
// HST-registered, the HST on a receipt is claimed back (an input tax
// credit), so only the pre-tax part is a cost. When it isn't registered, the
// whole amount paid is the cost. `taxCents` is only what the receipt shows —
// never assumed — so an expense with no recorded HST costs its full amount
// either way.
export function expenseCostCents(amountCents: number, taxCents: number, hstRegistered: boolean): number {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new RangeError(`amountCents must be a positive integer, got ${amountCents}`);
  if (!Number.isSafeInteger(taxCents) || taxCents < 0 || taxCents >= amountCents) throw new RangeError(`taxCents must be 0 ≤ tax < amount, got ${taxCents}`);
  return hstRegistered ? amountCents - taxCents : amountCents;
}

// "13%" / "14.975%" for display.
export function formatRate(rateBp: number): string {
  return `${(rateBp / 100).toFixed(3).replace(/\.?0+$/, '')}%`;
}
