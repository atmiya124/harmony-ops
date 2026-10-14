import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptLinkToken, encryptLinkToken, generateLinkToken, hashLinkToken, isWellFormedToken } from './clientLinkToken';
import { publicQuoteState } from './publicQuote';

process.env.BETTER_AUTH_SECRET ??= 'test-secret-for-client-links';

test('tokens: 256 random bits, url-safe, never repeated', () => {
  const tokens = new Set(Array.from({ length: 2000 }, generateLinkToken));
  assert.equal(tokens.size, 2000);
  for (const t of [...tokens].slice(0, 50)) {
    assert.match(t, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(t, 'base64url').length, 32);
  }
});

test('only well-formed tokens are looked up', () => {
  assert.equal(isWellFormedToken(generateLinkToken()), true);
  for (const bad of ['', 'abc', '5f0c7c1e-2d3b-4a8e-9f10-1234567890ab', `${generateLinkToken()}x`, `${generateLinkToken().slice(0, 42)}=`, "'; DROP TABLE quotes; --"]) {
    assert.equal(isWellFormedToken(bad), false, bad);
  }
});

test('hash: stable SHA-256, different for every token', () => {
  const t = generateLinkToken();
  assert.equal(hashLinkToken(t), hashLinkToken(t));
  assert.match(hashLinkToken(t), /^[0-9a-f]{64}$/);
  assert.notEqual(hashLinkToken(t), hashLinkToken(generateLinkToken()));
});

test('encryption round-trips, hides the token, and rejects tampering', () => {
  const t = generateLinkToken();
  const sealed = encryptLinkToken(t);
  assert.ok(!sealed.includes(t));
  assert.notEqual(encryptLinkToken(t), sealed); // random IV each time
  assert.equal(decryptLinkToken(sealed), t);
  const parts = sealed.split('.');
  parts[2] = Buffer.from('tampered').toString('base64url');
  assert.equal(decryptLinkToken(parts.join('.')), null);
  assert.equal(decryptLinkToken('garbage'), null);
});

test('public state from status and validity', () => {
  assert.equal(publicQuoteState('sent', '2026-10-13', '2026-10-13'), 'open'); // last valid day
  assert.equal(publicQuoteState('viewed', '2026-10-12', '2026-10-13'), 'expired');
  assert.equal(publicQuoteState('expired', '2027-01-01', '2026-10-13'), 'expired');
  assert.equal(publicQuoteState('accepted', '2026-01-01', '2026-10-13'), 'accepted'); // accepted stays accepted
  assert.equal(publicQuoteState('converted', '2026-01-01', '2026-10-13'), 'accepted');
  assert.equal(publicQuoteState('declined', '2027-01-01', '2026-10-13'), 'declined');
  assert.equal(publicQuoteState('draft', '2027-01-01', '2026-10-13'), 'unavailable');
  assert.equal(publicQuoteState('cancelled', '2027-01-01', '2026-10-13'), 'unavailable');
});
