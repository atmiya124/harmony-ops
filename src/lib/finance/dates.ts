// Display helpers for YYYY-MM-DD dates (parsed as local calendar dates, so
// a date never shifts by a day across timezones).

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayLocal(): string {
  return localIso(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return localIso(d);
}

// "Today", "Yesterday", "Sep 25" (this year) or "Sep 25, 2025".
export function friendlyDate(iso: string, today = todayLocal()): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  const d = parse(iso);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
