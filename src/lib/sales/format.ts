// Display formatting shared by the Sales screens and the PDF documents.

// "13 Oct, 2026", as on the printed documents; `fallback` when there's no date.
export function documentDate(iso: string | null | undefined, fallback = 'TBC'): string {
  if (!iso) return fallback;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const month = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' }); // "Oct" (en-CA gives "Oct.")
  return `${d} ${month}, ${y}`;
}
