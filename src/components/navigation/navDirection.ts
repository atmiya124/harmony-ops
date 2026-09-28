// How deep a screen sits in the app, used to decide whether a navigation
// is a push (deeper → slide in from the right), a pop (shallower → slide
// back) or a switch between siblings (same depth → subtle crossfade).
export function screenLevel(pathname: string): number {
  if (pathname === '/') return 0;
  if (/^\/events\/bookings\/[^/]+\/edit\/?$/.test(pathname)) return 3;
  if (/^\/events\/bookings\/[^/]+\/?$/.test(pathname)) return 2; // a booking, or /new
  return 1; // Bookings, Today, Finances, the calculators
}

// Where a screen's back chevron goes: one level up the app's hierarchy (not
// browser history, so it still works after opening a deep link).
export function parentOf(pathname: string): string {
  const edit = pathname.match(/^(\/events\/bookings\/[^/]+)\/edit\/?$/);
  if (edit) return edit[1];
  if (/^\/events\/bookings\/[^/]+\/?$/.test(pathname)) return '/events/bookings';
  return '/';
}

export type NavDirection = 'forward' | 'back' | 'fade' | 'none';

export function directionBetween(from: string, to: string): NavDirection {
  const a = screenLevel(from);
  const b = screenLevel(to);
  if (b > a) return 'forward';
  if (b < a) return 'back';
  return 'fade';
}
