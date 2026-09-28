import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from './auth';
import { isApprovedPartner, partnerDisplayName } from './allowlist';

export interface Partner {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

// The authoritative check. The proxy only looks for a session cookie; this
// validates the session itself and re-checks the allowlist, so an address
// removed from PARTNER_EMAILS loses access immediately, not just at their
// next sign-in.
export async function getPartnerFromHeaders(requestHeaders: Headers): Promise<Partner | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session || !isApprovedPartner(session.user.email)) return null;
  const { id, name, email, image } = session.user;
  return { id, name: partnerDisplayName(email, name), email, image: image ?? null };
}

export async function getCurrentPartner(): Promise<Partner | null> {
  return getPartnerFromHeaders(await headers());
}

type RouteHandler<R extends Request, C> = (req: R, ctx: C & { partner: Partner }) => Promise<Response>;

// Wraps a route handler so it only runs for a signed-in partner. Every
// /api route except /api/auth/* must use this — the proxy's cookie check
// alone is not a security boundary.
export function withPartner<R extends Request = Request, C = unknown>(handler: RouteHandler<R, C>) {
  return async (req: R, ctx: C): Promise<Response> => {
    let partner: Partner | null;
    try {
      partner = await getPartnerFromHeaders(req.headers);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Authentication failed' }, { status: 500 });
    }
    if (!partner) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    return handler(req, { ...ctx, partner });
  };
}
