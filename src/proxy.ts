import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { AUTH_COOKIE_PREFIX, isPublicClientPath, LOGIN_PATH, PATHNAME_HEADER } from '@/lib/auth/constants';

// Optimistic check only: is there a session cookie at all? It reads no
// database, so it can't tell a valid session from a stale one — the root
// layout and every /api route (via withPartner) verify the session for real.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isClientLink = isPublicClientPath(pathname);
  const isPublic = pathname === LOGIN_PATH || pathname.startsWith('/api/auth/') || isClientLink;
  const hasSessionCookie = Boolean(getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX }));

  if (!isPublic && !hasSessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const loginUrl = new URL(LOGIN_PATH, request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, `${pathname}${search}`);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isClientLink) {
    // The URL carries a secret token: never send it on as a referrer, keep
    // it out of search engines, and don't let shared caches keep the page.
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  // Everything except Next's build assets and the app icons/manifest/logo,
  // which must load on the login and client quote pages too.
  // brand/ holds the logo shown on the public client quote page.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|brand/).*)'],
};
