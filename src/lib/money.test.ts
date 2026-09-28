import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCents, formatCentsWhole, percentChange } from './money';

test('formats integer cents as CAD', () => {
  assert.equal(formatCents(6500), '$65.00');
  assert.equal(formatCents(4250), '$42.50');
  assert.equal(formatCents(123456789), '$1,234,567.89');
  assert.equal(formatCents(0), '$0.00');
  assert.equal(formatCentsWhole(425000), '$4,250');
  assert.equal(formatCentsWhole(425050), '$4,251');
});

test('percent change', () => {
  assert.equal(percentChange(8800, 10000), -12);
  assert.equal(percentChange(15000, 10000), 50);
  assert.equal(percentChange(100, 0), null);
});
