export type NavTab = 'home' | 'bookings' | 'sales' | 'finances';

// The Sales screens, in menu order. The profile button opens the Sales menu
// on any of them, and the tab bar highlights Sales.
export const SALES_PAGES = [
  { key: 'quotes', label: 'Quotes', href: '/quotes' },
  { key: 'invoices', label: 'Invoices', href: '/invoices' },
  { key: 'inventory', label: 'Inventory', href: '/inventory' },
  { key: 'customers', label: 'Customers', href: '/customers' },
] as const;

export type SalesPageKey = (typeof SALES_PAGES)[number]['key'];

// The Sales page a path belongs to (e.g. /quotes/123/edit -> quotes), or null.
export function salesPageFor(pathname: string): SalesPageKey | null {
  return SALES_PAGES.find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`))?.key ?? null;
}
