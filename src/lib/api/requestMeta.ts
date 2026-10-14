import type { RequestMeta } from '../db/clientLinkRepo';

// The client's IP and browser for an acceptance record — for the record only,
// never used to decide anything (an IP is not an identity). On Vercel the
// first x-forwarded-for entry is the client.
export function requestMeta(req: Request): RequestMeta {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip')?.trim() || null;
  const ua = req.headers.get('user-agent');
  return { ipAddress: ip ? ip.slice(0, 64) : null, userAgent: ua ? ua.slice(0, 500) : null };
}

// Rejects bodies over `max` bytes before parsing (a drawn signature is the
// largest thing a client sends).
export function tooLarge(req: Request, max: number): boolean {
  const length = Number(req.headers.get('content-length') ?? '0');
  return Number.isFinite(length) && length > max;
}
