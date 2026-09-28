import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGoogleIdentity, isApprovedPartner, parsePartnerEmails } from './allowlist';

const allowlist = parsePartnerEmails(' Alice@Example.com, bob@example.com ;carol@example.com\ndave@example.com,, not-an-email ');

test('parses comma/semicolon/newline separated emails, lowercased, ignoring junk', () => {
  assert.deepEqual([...allowlist].sort(), ['alice@example.com', 'bob@example.com', 'carol@example.com', 'dave@example.com']);
});

test('empty or missing PARTNER_EMAILS approves nobody', () => {
  assert.equal(parsePartnerEmails(undefined).size, 0);
  assert.equal(parsePartnerEmails('').size, 0);
  assert.equal(isApprovedPartner('alice@example.com', parsePartnerEmails('')), false);
});

test('matching is case- and whitespace-insensitive', () => {
  assert.equal(isApprovedPartner('  ALICE@example.COM ', allowlist), true);
});

test('rejects addresses not on the list, including lookalikes', () => {
  assert.equal(isApprovedPartner('eve@example.com', allowlist), false);
  assert.equal(isApprovedPartner('alice@example.com.evil.io', allowlist), false);
  assert.equal(isApprovedPartner('xalice@example.com', allowlist), false);
  assert.equal(isApprovedPartner(null, allowlist), false);
  assert.equal(isApprovedPartner('', allowlist), false);
});

test('Google identity must be verified AND approved', () => {
  assert.equal(checkGoogleIdentity('bob@example.com', true, allowlist), undefined);
  assert.equal(checkGoogleIdentity('bob@example.com', false, allowlist)?.error, 'email_not_verified');
  assert.equal(checkGoogleIdentity('bob@example.com', undefined, allowlist)?.error, 'email_not_verified');
  // A truthy-but-not-true value (e.g. the string "true") is not trusted.
  assert.equal(checkGoogleIdentity('bob@example.com', 'true', allowlist)?.error, 'email_not_verified');
  assert.equal(checkGoogleIdentity('eve@example.com', true, allowlist)?.error, 'not_a_partner');
});
