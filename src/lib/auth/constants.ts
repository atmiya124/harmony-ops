// Kept separate from auth.ts so the proxy can import it without pulling the
// database client and Better Auth server into its bundle.
export const AUTH_COOKIE_PREFIX = 'harmony';

// Set by the proxy on every request (path + query) so server components (the root layout)
// know which path is being rendered.
export const PATHNAME_HEADER = 'x-harmony-pathname';

export const LOGIN_PATH = '/login';

// The only pages and API routes a client can open without signing in: their
// own quote, reached through a secret link (/q/<token>). Everything else in
// the app requires a partner session.
export const CLIENT_QUOTE_PAGE_PREFIX = '/q/';
export const PUBLIC_API_PREFIX = '/api/public/';

export function isPublicClientPath(pathname: string): boolean {
  return pathname.startsWith(CLIENT_QUOTE_PAGE_PREFIX) || pathname.startsWith(PUBLIC_API_PREFIX);
}
