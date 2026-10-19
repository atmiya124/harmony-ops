// Harmony Production's starting values for a new quote — the one place this
// business policy lives. Each quote stores its own copy (rate, deposit,
// terms), so changing a default here never alters an existing quote. The
// tax rate itself comes from finance settings when one is saved there.

import { DEFAULT_HST_RATE_BP } from '../finance/types';
import type { AdjustmentType, QuoteClientType } from './types';

// The default Terms & Conditions for each client type, one term per line.
// The builder loads the one for the quote's client type; staff can edit it,
// and the quote saves the exact text it ends up with.
export const QUOTE_TERMS: Record<QuoteClientType, string> = {
  regular: [
    'Payment: A 30% non-refundable deposit is required to secure your booking. The remaining 70% balance must be paid in full on the day of the event.',
    'Cancellations: Deposits are non-refundable. Cancellations made within 7 days of the event may be charged in full.',
    'Changes: Any additional requests or changes may incur extra charges.',
    'Equipment: Client is responsible for all rented equipment (damage/loss billed).',
    'Setup: Client must provide proper access, power, and safe working conditions. Delays may result in extra fees.',
    'Liability: Not responsible for delays due to factors beyond our control (e.g., weather, power issues).',
    'Acceptance: Payment confirms agreement to these terms.',
  ].join('\n'),
  // DRAFT wording — replace with the business's contract terms.
  contract: [
    'Payment: Services are invoiced as set out in the client agreement. Invoices are due within 30 days of the invoice date unless the agreement states otherwise.',
    'Cancellations: Cancellations are handled as set out in the client agreement. Cancellations made within 7 days of the event may be charged in full.',
    'Changes: Any additional requests or changes outside the agreed scope may incur extra charges.',
    'Equipment: Client is responsible for all rented equipment (damage/loss billed).',
    'Setup: Client must provide proper access, power, and safe working conditions. Delays may result in extra fees.',
    'Liability: Not responsible for delays due to factors beyond our control (e.g., weather, power issues).',
    'Acceptance: Signing this quote confirms agreement to these terms and the client agreement.',
  ].join('\n'),
};

export interface QuoteDefaults {
  taxLabel: string;
  taxRateBp: number;
  validityDays: number;
  discountType: AdjustmentType;
  discountValue: number;
  depositType: AdjustmentType;
  depositValue: number;
  clientType: QuoteClientType; // its terms come from QUOTE_TERMS
}

export const QUOTE_DEFAULTS: QuoteDefaults = {
  taxLabel: 'HST',
  taxRateBp: DEFAULT_HST_RATE_BP,
  validityDays: 30,
  discountType: 'none',
  discountValue: 0,
  depositType: 'percent',
  depositValue: 3000, // 30%, as the regular payment term says
  clientType: 'regular',
};
