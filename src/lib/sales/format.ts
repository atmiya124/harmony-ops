// Display formatting shared by the Sales screens and the PDF documents.

// "13 Oct, 2026", as on the printed documents; `fallback` when there's no date.
export function documentDate(iso: string | null | undefined, fallback = 'TBC'): string {
  if (!iso) return fallback;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const month = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' }); // "Oct" (en-CA gives "Oct.")
  return `${d} ${month}, ${y}`;
}

// The Toronto calendar date (YYYY-MM-DD) of a moment (an ISO timestamp).
export function torontoDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
}

// "Oct 14, 2026 at 11:42 AM" for a moment, in Toronto time (in-app
// activity lines, e.g. when a quote was emailed).
export function activityDateTime(iso: string): string {
  const at = new Date(iso);
  const date = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Toronto' });
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' });
  return `${date} at ${time}`;
}

// "13 Oct, 2026, 3:05 p.m." for a moment, in Toronto time.
export function documentDateTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' });
  return `${documentDate(torontoDate(iso))}, ${time}`;
}
