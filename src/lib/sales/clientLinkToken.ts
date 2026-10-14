// Secret tokens for client quote links (/q/<token>). Server-only.
//
//   token      32 random bytes (256 bits) as base64url — unguessable, and not
//              derived from anything (quote id, time, counter).
//   tokenHash  SHA-256 of the token; the only thing used to find a link, so
//              a request is matched without the token ever being stored or
//              compared in plain form.
//   encrypted  the token sealed with AES-256-GCM under a key derived from
//              the server secret, kept only so staff can copy the link again
//              later. A copy of the database alone can't open any link.
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes as unpadded base64url

export function generateLinkToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

// Cheap shape check before touching the database; anything else is not a token.
export function isWellFormedToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set; it is needed to protect client quote links.');
  // A dedicated key for this purpose, derived from (not equal to) the secret.
  return Buffer.from(hkdfSync('sha256', secret, 'harmony-ops', 'client-quote-link-token v1', 32));
}

// "v1.<iv>.<ciphertext>.<tag>", all base64url.
export function encryptLinkToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), data.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

// Null when it can't be opened (e.g. the server secret was rotated) — the
// link still works for the client; staff just regenerate to copy a new one.
export function decryptLinkToken(sealed: string): string | null {
  try {
    const [version, iv, data, tag] = sealed.split('.');
    if (version !== 'v1' || !iv || !data || !tag) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export const CLIENT_QUOTE_PATH = '/q/';
