import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bpToInput, formatBp, parsePercentToBp, parsePriceToCents, parseQuantity, priceToInput } from './inputs';
import { formatDocumentNumber, canSetQuoteStatus, isQuoteEditable } from './types';

test('prices: dollars to cents, zero allowed', () => {
  assert.deepEqual(parsePriceToCents('2400'), { ok: true, value: 240000 });
  assert.deepEqual(parsePriceToCents('$1,250.50'), { ok: true, value: 125050 });
  assert.deepEqual(parsePriceToCents('0'), { ok: true, value: 0 });
  assert.deepEqual(parsePriceToCents('0.00'), { ok: true, value: 0 });
  assert.equal(parsePriceToCents('').ok, false);
  assert.equal(parsePriceToCents('abc').ok, false);
  assert.equal(parsePriceToCents('1.234').ok, false);
  assert.equal(parsePriceToCents('-5').ok, false);
});

test('percentages to basis points', () => {
  assert.deepEqual(parsePercentToBp('13'), { ok: true, value: 1300 });
  assert.deepEqual(parsePercentToBp('12.5'), { ok: true, value: 1250 });
  assert.deepEqual(parsePercentToBp('12.50%'), { ok: true, value: 1250 });
  assert.deepEqual(parsePercentToBp('0'), { ok: true, value: 0 });
  assert.deepEqual(parsePercentToBp('.5'), { ok: true, value: 50 });
  assert.equal(parsePercentToBp('100.01').ok, false);
  assert.equal(parsePercentToBp('1.234').ok, false);
  assert.equal(parsePercentToBp('').ok, false);
  assert.equal(parsePercentToBp('35', 3000).ok, false);
});

test('quantities are whole numbers from 1', () => {
  assert.deepEqual(parseQuantity('4'), { ok: true, value: 4 });
  assert.equal(parseQuantity('0').ok, false);
  assert.equal(parseQuantity('1.5').ok, false);
  assert.equal(parseQuantity('').ok, false);
});

test('stored values back to editable text', () => {
  assert.equal(bpToInput(1300), '13');
  assert.equal(bpToInput(1250), '12.5');
  assert.equal(bpToInput(5), '0.05');
  assert.equal(formatBp(500), '5%');
  assert.equal(priceToInput(240000), '2400.00');
  assert.equal(priceToInput(0), '0');
});

test('document numbers', () => {
  assert.equal(formatDocumentNumber('Q-', 1), 'Q-000000001');
  assert.equal(formatDocumentNumber('INV-', 218), 'INV-000000218');
  assert.throws(() => formatDocumentNumber('Q-', 0));
});

test('quote status rules', () => {
  assert.equal(isQuoteEditable('draft'), true);
  assert.equal(isQuoteEditable('sent'), true);
  assert.equal(isQuoteEditable('accepted'), false);
  assert.equal(isQuoteEditable('converted'), false);
  assert.equal(canSetQuoteStatus('draft', 'sent'), true);
  assert.equal(canSetQuoteStatus('sent', 'accepted'), true);
  assert.equal(canSetQuoteStatus('draft', 'draft'), false);
  assert.equal(canSetQuoteStatus('draft', 'converted'), false); // only by creating the invoice
  assert.equal(canSetQuoteStatus('converted', 'draft'), false);
});
