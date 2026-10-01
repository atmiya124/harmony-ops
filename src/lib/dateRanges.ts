// Date ranges for financial screens: a calendar month (picked from a list)
// or a rolling preset. All dates are local calendar dates as 'YYYY-MM-DD'
// strings (how expense dates are stored), so there is no timezone drift
// between "today" on a phone and the stored dates.

export type PresetRangeKey = '3M' | 'YTD' | '1Y' | 'ALL';

// A single calendar month, as 'YYYY-MM'.
export interface MonthRange {
  month: string;
}

export type DateRange = PresetRangeKey | MonthRange;

export const DATE_RANGES: { key: PresetRangeKey; short: string; label: string; comparedTo: string | null }[] = [
  { key: '3M', short: '3M', label: 'Last 3 months', comparedTo: 'previous 3 months' },
  { key: 'YTD', short: 'YTD', label: 'Year to date', comparedTo: 'same period last year' },
  { key: '1Y', short: '1Y', label: 'Last 12 months', comparedTo: 'previous 12 months' },
  { key: 'ALL', short: 'ALL', label: 'All time', comparedTo: null },
];

export function isMonthRange(range: DateRange): range is MonthRange {
  return typeof range === 'object';
}

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

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return toIsoDate(new Date(y, m, 0));
}

export function currentPeriod(range: DateRange, today: string): Period {
  if (isMonthRange(range)) {
    // The current month runs to today; a past month is the whole month.
    const monthEnd = lastDayOfMonth(range.month);
    return { start: `${range.month}-01`, end: monthEnd < today ? monthEnd : today };
  }
  switch (range) {
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
// with the same days of last month, a whole past month with the whole
// month before it.
export function previousPeriod(range: DateRange, today: string): Period | null {
  if (isMonthRange(range)) {
    const { start, end } = currentPeriod(range, today);
    const previousStart = addMonths(start!, -1);
    const wholeMonth = end === lastDayOfMonth(range.month);
    return { start: previousStart, end: wholeMonth ? lastDayOfMonth(previousStart.slice(0, 7)) : addMonths(end, -1) };
  }
  switch (range) {
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

// What the change indicator compares against ("vs …").
export function comparedTo(range: DateRange, today: string): string | null {
  if (!isMonthRange(range)) return DATE_RANGES.find((r) => r.key === range)!.comparedTo;
  if (range.month === today.slice(0, 7)) return 'same days last month';
  return MONTH_LONG.format(parse(previousPeriod(range, today)!.start!));
}

// Every month from the earliest date up to today's month, newest first —
// the choices in the month picker.
export function monthsSince(earliest: string, today: string): string[] {
  const out: string[] = [];
  const first = earliest.slice(0, 7);
  for (let m = `${today.slice(0, 7)}-01`; m.slice(0, 7) >= first; m = addMonths(m, -1)) out.push(m.slice(0, 7));
  return out;
}

// "Sep" this year, "Sep 2025" otherwise.
export function monthLabel(month: string, today: string): string {
  return (month.slice(0, 4) === today.slice(0, 4) ? MONTH_SHORT_US : MONTH_YEAR_US).format(parse(`${month}-01`));
}

export function inPeriod(date: string, period: Period): boolean {
  return (period.start === null || date >= period.start) && date <= period.end;
}

const MONTH = new Intl.DateTimeFormat('en-CA', { month: 'short' });
const MONTH_YEAR = new Intl.DateTimeFormat('en-CA', { month: 'short', year: 'numeric' });
const DAY = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });
const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long' });
// en-US: "Sep", where en-CA can give "Sept."
const MONTH_SHORT_US = new Intl.DateTimeFormat('en-US', { month: 'short' });
const MONTH_YEAR_US = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

// Splits amounts into chart points for a range: days for a month, weeks for
// 3M, months for YTD/1Y/ALL. Empty buckets are kept as 0 so the x-axis is
// continuous time, not just the days something happened.
export function bucketize(entries: { date: string; cents: number }[], range: DateRange, today: string): { label: string; value: number }[] {
  const period = currentPeriod(range, today);
  const inRange = entries.filter((e) => inPeriod(e.date, period));
  const start = period.start ?? inRange.reduce((min, e) => (e.date < min ? e.date : min), today);

  if (isMonthRange(range)) {
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
