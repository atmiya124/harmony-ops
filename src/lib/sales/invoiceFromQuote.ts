// Starting values for the invoice made from an accepted quote (Phase 4).
// The invoice copies the quote's items and figures exactly; these are the
// only choices left, and staff can change both in the convert dialog.

import type { QuoteClientType, QuoteStatus } from './types';

// Contract clients pay on account: the contract terms say 30 days.
export const CONTRACT_PAYMENT_DAYS = 30;

// "YYYY-MM-DD" plus whole days, as a calendar date.
export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// When the balance is due. A regular client pays the balance on the day of
// the event (see QUOTE_TERMS); with no event date, or one already past, it's
// due today. A contract client gets CONTRACT_PAYMENT_DAYS.
export function defaultInvoiceDueDate(quote: { clientType: QuoteClientType; eventDate: string | null }, today: string): string {
  if (quote.clientType === 'contract') return addCalendarDays(today, CONTRACT_PAYMENT_DAYS);
  return quote.eventDate && quote.eventDate > today ? quote.eventDate : today;
}

// Why a quote can't be converted to an invoice, or null if it can. Only an
// accepted quote can — accepted by the client through their link or marked
// Accepted by staff — and only once: converting marks it Converted.
export function convertBlocker(status: QuoteStatus): string | null {
  if (status === 'accepted') return null;
  if (status === 'converted') return 'This quote has already been converted to an invoice.';
  return 'Only an accepted quote can be converted to an invoice.';
}
