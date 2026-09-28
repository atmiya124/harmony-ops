// Money is stored and passed around as integer cents (CAD) so sums never
// pick up floating-point drift; these helpers only turn cents into text.

const cadWithCents = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' });
const cadWhole = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
});
const cadCompact = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'narrowSymbol',
  notation: 'compact',
  maximumFractionDigits: 1,
});

// $1,234.50 — transaction rows, tooltips.
export function formatCents(cents: number): string {
  return cadWithCents.format(cents / 100);
}

// $4,250 — headline figures. Rounds to the nearest dollar.
export function formatCentsWhole(cents: number): string {
  return cadWhole.format(Math.round(cents / 100));
}

// $12.9K — tight spaces such as chart axis ticks.
export function formatCentsCompact(cents: number): string {
  return cadCompact.format(cents / 100);
}

export type ParsedAmount = { ok: true; cents: number } | { ok: false; error: string };

// Turns what someone types into an amount field into integer cents, using
// string arithmetic only (no float rounding: "0.29" is 29, not 28.999…).
// Accepts "45", "45.5", "$1,234.56", ".50", and a decimal comma ("45,50")
// as typed on French-Canadian phone keypads. Rejects negatives, more than
// two decimals, zero, and anything over the $1,000,000 guard rail.
export function parseAmountToCents(input: string, maxCents = 100_000_000): ParsedAmount {
  let s = input.trim().replace(/^\$\s*/, '').replace(/\s+/g, '');
  if (!s) return { ok: false, error: 'Enter an amount' };
  // A single comma followed by 1–2 digits and no dot is a decimal comma;
  // otherwise commas are thousands separators.
  if (!s.includes('.') && /^\d*,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m || (m[1] === '' && !m[2])) {
    return { ok: false, error: /\.\d{3,}$/.test(s) ? 'Use at most 2 decimal places' : 'Enter a valid amount, e.g. 45.50' };
  }
  const dollars = m[1] === '' ? 0 : Number(m[1]);
  const cents = dollars * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return { ok: false, error: 'Amount is too large' };
  if (cents <= 0) return { ok: false, error: 'Amount must be more than $0' };
  if (cents > maxCents) return { ok: false, error: `Amount can't exceed ${formatCents(maxCents)}` };
  return { ok: true, cents };
}

// Cents to the plain editable form used to prefill an input: 4250 -> "42.50".
export function centsToInput(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(Math.abs(cents % 100)).padStart(2, '0')}`;
}

// Signed percentage change from `previous` to `current`, or null when there
// is no meaningful baseline (nothing last period).
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
