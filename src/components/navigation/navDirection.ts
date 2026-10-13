// How deep a screen sits in the app, used to decide whether a navigation
// is a push (deeper → slide in from the right), a pop (shallower → slide
// back) or a switch between siblings (same depth → subtle crossfade).
export function screenLevel(pathname: string): number {
  if (pathname === '/') return 0;
  if (/^\/events\/bookings\/[^/]+\/edit\/?$/.test(pathname)) return 3;
  if (/^\/events\/bookings\/[^/]+\/?$/.test(pathname)) return 2; // a booking, or /new
  // An expense (opened from Finances or a booking), and its edit sheet,
  // which opens over the same screen.
  if (/^\/expenses\/[^/]+(\/edit)?\/?$/.test(pathname)) return 3;
  if (/^\/quotes\/[^/]+\/edit\/?$/.test(pathname)) return 3;
  if (/^\/(quotes|invoices)\/[^/]+\/?$/.test(pathname)) return 2; // a quote or invoice, or /quotes/new
  return 1; // Bookings, Today, Finances, Quotes, Invoices, the calculators
}

// Where a screen's back chevron goes: one level up the app's hierarchy (not
// browser history, so it still works after opening a deep link).
export function parentOf(pathname: string): string {
  const edit = pathname.match(/^(\/events\/bookings\/[^/]+)\/edit\/?$/);
  if (edit) return edit[1];
  if (/^\/events\/bookings\/[^/]+\/?$/.test(pathname)) return '/events/bookings';
  const expenseEdit = pathname.match(/^(\/expenses\/[^/]+)\/edit\/?$/);
  if (expenseEdit) return expenseEdit[1];
  if (/^\/expenses\/[^/]+\/?$/.test(pathname)) return '/finances';
  const quoteEdit = pathname.match(/^(\/quotes\/[^/]+)\/edit\/?$/);
  if (quoteEdit) return quoteEdit[1];
  if (/^\/quotes\/[^/]+\/?$/.test(pathname)) return '/quotes';
  if (/^\/invoices\/[^/]+\/?$/.test(pathname)) return '/invoices';
  return '/';
}

// Two paths drawn by the same mounted screen: an expense and its Edit sheet,
// which opens over the details without moving them.
export function sameScreen(a: string, b: string): boolean {
  const expense = (p: string) => p.match(/^(\/expenses\/[^/]+)(\/edit)?\/?$/)?.[1];
  const screen = expense(a);
  return screen !== undefined && screen === expense(b);
}

export type NavDirection = 'forward' | 'back' | 'fade' | 'none';

export function directionBetween(from: string, to: string): NavDirection {
  const a = screenLevel(from);
  const b = screenLevel(to);
  if (b > a) return 'forward';
  if (b < a) return 'back';
  return 'fade';
}
