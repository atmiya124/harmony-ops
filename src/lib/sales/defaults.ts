// Harmony Production's starting values for a new quote — the one place this
// business policy lives. Each quote stores its own copy (rate, deposit,
// terms), so changing a default here never alters an existing quote. The
// tax rate itself comes from finance settings when one is saved there.

import { DEFAULT_HST_RATE_BP } from '../finance/types';
import type { AdjustmentType } from './types';

export interface QuoteDefaults {
  taxLabel: string;
  taxRateBp: number;
  validityDays: number;
  discountType: AdjustmentType;
  discountValue: number;
  depositType: AdjustmentType;
  depositValue: number;
  terms: string;
}

export const QUOTE_DEFAULTS: QuoteDefaults = {
  taxLabel: 'HST',
  taxRateBp: DEFAULT_HST_RATE_BP,
  validityDays: 30,
  discountType: 'none',
  discountValue: 0,
  depositType: 'percent',
  depositValue: 5000, // 50%
  terms: [
    'A 50% non-refundable deposit is required to confirm the booking. The remaining balance is due 3 days before the event date.',
    'Prices quoted are valid for 30 days from the quote date and are subject to equipment availability at the time of booking.',
    'The client is responsible for providing safe venue access, an adequate power supply and any permits required by the venue.',
    'Cancellations made less than 14 days before the event will be charged 50% of the total quoted amount.',
    'Any damage to equipment caused by guests or venue staff will be charged to the client at repair or replacement cost.',
  ].join('\n'),
};
