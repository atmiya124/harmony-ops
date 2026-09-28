// Harmony Production works in Ontario, so "today" for dating expenses is
// the Toronto calendar date — not UTC, which is already tomorrow on a
// late-evening entry.
export const FINANCE_TIMEZONE = 'America/Toronto';

export function todayInFinanceTz(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: FINANCE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
