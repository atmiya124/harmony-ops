// Date-range presets for financial screens. All dates are local calendar
// dates as 'YYYY-MM-DD' strings (how expense dates are stored), so there is
// no timezone drift between "today" on a phone and the stored dates.

export type DateRangeKey = '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';

export const DATE_RANGES: { key: DateRangeKey; short: string; label: string; comparedTo: string | null }[] = [
  { key: '1W', short: '1W', label: 'Last 7 days', comparedTo: 'previous 7 days' },
  { key: '1M', short: '1M', label: 'This month', comparedTo: 'last month' },
  { key: '3M', short: '3M', label: 'Last 3 months', comparedTo: 'previous 3 months' },
  { key: 'YTD', short: 'YTD', label: 'Year to date', comparedTo: 'same period last year' },
  { key: '1Y', short: '1Y', label: 'Last 12 months', comparedTo: 'previous 12 months' },
  { key: 'ALL', short: 'ALL', label: 'All time', comparedTo: null },
];

export interface Period {
  start: string | null; // inclusive; null = beginning of time
  end: string; // inclusive
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

// Same day-of-month `months` away, clamped to the target month's length
// (Mar 31 − 1 month → Feb 28/29, not Mar 3).
function addMonths(iso: string, months: number): string {
  const d = parse(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toIsoDate(target);
}

export function currentPeriod(range: DateRangeKey, today: string): Period {
  switch (range) {
    case '1W':
      return { start: addDays(today, -6), end: today };
    case '1M':
      return { start: `${today.slice(0, 7)}-01`, end: today };
    case '3M':
      return { start: addDays(addMonths(today, -3), 1), end: today };
    case 'YTD':
      return { start: `${today.slice(0, 4)}-01-01`, end: today };
    case '1Y':
      return { start: addDays(addMonths(today, -12), 1), end: today };
    case 'ALL':
      return { start: null, end: today };
  }
}

// The like-for-like period to compare against: month-to-date is compared
// with the same days of last month, not all of last month.
export function previousPeriod(range: DateRangeKey, today: string): Period | null {
  switch (range) {
    case '1W':
      return { start: addDays(today, -13), end: addDays(today, -7) };
    case '1M': {
      const end = addMonths(today, -1);
      return { start: `${end.slice(0, 7)}-01`, end };
    }
    case '3M':
      return { start: addDays(addMonths(today, -6), 1), end: addMonths(today, -3) };
    case 'YTD': {
      const end = addMonths(today, -12);
      return { start: `${end.slice(0, 4)}-01-01`, end };
    }
    case '1Y':
      return { start: addDays(addMonths(today, -24), 1), end: addMonths(today, -12) };
    case 'ALL':
      return null;
  }
}

export function inPeriod(date: string, period: Period): boolean {
  return (period.start === null || date >= period.start) && date <= period.end;
}

const MONTH = new Intl.DateTimeFormat('en-CA', { month: 'short' });
const MONTH_YEAR = new Intl.DateTimeFormat('en-CA', { month: 'short', year: 'numeric' });
const DAY = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });

// Splits amounts into chart points for a range: days for 1W/1M, weeks for
// 3M, months for YTD/1Y/ALL. Empty buckets are kept as 0 so the x-axis is
// continuous time, not just the days something happened.
export function bucketize(entries: { date: string; cents: number }[], range: DateRangeKey, today: string): { label: string; value: number }[] {
  const period = currentPeriod(range, today);
  const inRange = entries.filter((e) => inPeriod(e.date, period));
  const start = period.start ?? inRange.reduce((min, e) => (e.date < min ? e.date : min), today);

  if (range === '1W' || range === '1M') {
    const out: { label: string; value: number }[] = [];
    for (let d = start; d <= period.end; d = addDays(d, 1)) {
      out.push({ label: DAY.format(parse(d)), value: sumWhere(inRange, (e) => e.date === d) });
    }
    return out;
  }

  if (range === '3M') {
    const out: { label: string; value: number }[] = [];
    for (let d = start; d <= period.end; d = addDays(d, 7)) {
      const weekEnd = addDays(d, 6) < period.end ? addDays(d, 6) : period.end;
      out.push({ label: `Week of ${DAY.format(parse(d))}`, value: sumWhere(inRange, (e) => e.date >= d && e.date <= weekEnd) });
    }
    return out;
  }

  const out: { label: string; value: number }[] = [];
  const spansYears = start.slice(0, 4) !== period.end.slice(0, 4);
  for (let m = `${start.slice(0, 7)}-01`; m <= period.end; m = addMonths(m, 1)) {
    const prefix = m.slice(0, 7);
    out.push({ label: (spansYears ? MONTH_YEAR : MONTH).format(parse(m)), value: sumWhere(inRange, (e) => e.date.startsWith(prefix)) });
  }
  return out;
}

// Running total across buckets — "spent so far this period". Line charts use
// this: sparse spending as raw daily totals is a row of spikes, while the
// running total reads as a trend.
export function accumulate(buckets: { label: string; value: number }[]): { label: string; value: number }[] {
  let total = 0;
  return buckets.map((b) => ({ label: b.label, value: (total += b.value) }));
}

function sumWhere(entries: { date: string; cents: number }[], pred: (e: { date: string; cents: number }) => boolean): number {
  return entries.reduce((sum, e) => (pred(e) ? sum + e.cents : sum), 0);
}
