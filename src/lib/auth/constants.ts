// Kept separate from auth.ts so the proxy can import it without pulling the
// database client and Better Auth server into its bundle.
export const AUTH_COOKIE_PREFIX = 'harmony';

// Set by the proxy on every request (path + query) so server components (the root layout)
// know which path is being rendered.
export const PATHNAME_HEADER = 'x-harmony-pathname';

export const LOGIN_PATH = '/login';
