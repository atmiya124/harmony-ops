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

// Signed percentage change from `previous` to `current`, or null when there
// is no meaningful baseline (nothing last period).
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
