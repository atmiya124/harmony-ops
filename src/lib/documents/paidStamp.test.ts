import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAID_STAMP_SVG } from './paidStamp';

// The PDF's copy of the seal must match the icon in public/. If this fails,
// regenerate paidStamp.ts:
//   node -e "console.log(require('fs').readFileSync('public/icons/paid.svg').toString('base64'))"
test('the inlined PAID seal matches public/icons/paid.svg', () => {
  const file = readFileSync('public/icons/paid.svg').toString('base64');
  assert.equal(PAID_STAMP_SVG, `data:image/svg+xml;base64,${file}`);
});
