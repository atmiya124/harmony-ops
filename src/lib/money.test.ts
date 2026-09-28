import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centsToInput, formatCents, formatCentsWhole, parseAmountToCents, percentChange } from './money';

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

test('parses typed amounts to exact cents', () => {
  const ok = (input: string) => { const r = parseAmountToCents(input); assert.ok(r.ok, input + ': ' + (!r.ok && r.error)); return r.cents; };
  assert.equal(ok('45'), 4500);
  assert.equal(ok('45.5'), 4550);
  assert.equal(ok('45.50'), 4550);
  assert.equal(ok('0.29'), 29); // no float drift
  assert.equal(ok('.5'), 50);
  assert.equal(ok('$1,234.56'), 123456);
  assert.equal(ok(' 12 '), 1200);
  assert.equal(ok('45,50'), 4550); // decimal comma (fr-CA keypad)
  assert.equal(ok('1,234'), 123400); // thousands comma
  assert.equal(ok('1000000'), 100000000);
});

test('rejects bad typed amounts with a helpful message', () => {
  for (const bad of ['', '  ', 'abc', '-5', '0', '0.00', '1.234', '1e5', '1.2.3', '$', '.']) {
    const r = parseAmountToCents(bad);
    assert.equal(r.ok, false, bad);
  }
  const tooBig = parseAmountToCents('1000000.01');
  assert.ok(!tooBig.ok && tooBig.error.includes('exceed'));
  const decimals = parseAmountToCents('4.505');
  assert.ok(!decimals.ok && decimals.error.includes('2 decimal'));
});

test('cents back to editable input text', () => {
  assert.equal(centsToInput(4250), '42.50');
  assert.equal(centsToInput(5), '0.05');
  assert.equal(centsToInput(100000), '1000.00');
  for (const c of [1, 29, 4550, 123456]) { const r = parseAmountToCents(centsToInput(c)); assert.ok(r.ok && r.cents === c); }
});
