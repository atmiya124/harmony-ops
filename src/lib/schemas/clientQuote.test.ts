import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPngDataUrl, quoteAcceptInputSchema, quoteDeclineInputSchema } from './clientQuote';

const PNG = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(30)]).toString('base64');

const valid = (o: Record<string, unknown> = {}) => ({
  version: '2026-10-13T00:00:00.000Z',
  customerName: 'Daniel Smith',
  customerTitle: '',
  acceptedTerms: true,
  signature: { type: 'typed', value: 'Daniel Smith' },
  ...o,
});

const paths = (input: unknown) => {
  const r = quoteAcceptInputSchema.safeParse(input);
  assert.equal(r.success, false);
  return r.error!.issues.map((i) => i.path.join('.'));
};

test('a complete acceptance passes, tidied up', () => {
  const r = quoteAcceptInputSchema.parse(valid({ customerName: '  Daniel \n  Smith ', customerTitle: '  ' }));
  assert.equal(r.customerName, 'Daniel Smith');
  assert.equal(r.customerTitle, null);
  assert.equal(quoteAcceptInputSchema.parse(valid({ signature: { type: 'drawn', value: PNG } })).signature.type, 'drawn');
});

test('name, ticked terms and a signature are all required', () => {
  assert.deepEqual(paths(valid({ customerName: '   ' })), ['customerName']);
  assert.deepEqual(paths(valid({ acceptedTerms: false })), ['acceptedTerms']);
  assert.deepEqual(paths(valid({ acceptedTerms: 'true' })), ['acceptedTerms']); // must be a real true
  assert.deepEqual(paths(valid({ signature: undefined })), ['signature']);
  assert.deepEqual(paths(valid({ signature: { type: 'typed', value: '  ' } })), ['signature.value']);
  assert.deepEqual(paths(valid({ signature: { type: 'stamp', value: 'x' } })), ['signature.type']);
  assert.deepEqual(paths(valid({ version: '' })), ['version']);
});

test('a drawn signature must really be a PNG of sensible size', () => {
  assert.equal(isPngDataUrl(PNG), true);
  assert.equal(isPngDataUrl('data:image/png;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64')), false);
  assert.equal(isPngDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isPngDataUrl('javascript:alert(1)'), false);
  assert.equal(isPngDataUrl(PNG + 'A'.repeat(250_000)), false);
  assert.deepEqual(paths(valid({ signature: { type: 'drawn', value: 'data:image/png;base64,AAAA' } })), ['signature.value']);
});

test('decline: reason optional and trimmed', () => {
  assert.equal(quoteDeclineInputSchema.parse({ version: 'v' }).reason, null);
  assert.equal(quoteDeclineInputSchema.parse({ version: 'v', reason: '  Budget changed ' }).reason, 'Budget changed');
  assert.equal(quoteDeclineInputSchema.safeParse({ version: 'v', reason: 'x'.repeat(1001) }).success, false);
});
