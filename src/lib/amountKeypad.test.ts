import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyKeypadKey, formatKeypadAmount, keypadKeyFromKeyboard, type KeypadKey } from './amountKeypad';
import { parseAmountToCents } from './money';

const type = (keys: KeypadKey[], start = '') => keys.reduce(applyKeypadKey, start);

test('digits build the amount', () => {
  assert.equal(type(['4', '2', '.', '1', '8']), '42.18');
});

test('a leading dot becomes "0."', () => {
  assert.equal(type(['.', '5']), '0.5');
});

test('only one decimal point', () => {
  assert.equal(type(['1', '.', '.', '5']), '1.5');
});

test('at most two decimal places', () => {
  assert.equal(type(['9', '.', '9', '9', '9']), '9.99');
});

test('a leading zero is replaced', () => {
  assert.equal(type(['0', '0', '7']), '7');
  assert.equal(type(['0', '.', '0', '5']), '0.05');
});

test('whole dollars are capped at 7 digits', () => {
  assert.equal(type(['1', '2', '3', '4', '5', '6', '7', '8']), '1234567');
  assert.equal(type(['.', '5'], '1234567'), '1234567.5');
});

test('backspace removes the last character and stops at empty', () => {
  assert.equal(type(['backspace'], '42.18'), '42.1');
  assert.equal(type(['backspace', 'backspace'], '5'), '');
});

test('keypad output always parses (or gives a clear error)', () => {
  assert.deepEqual(parseAmountToCents(type(['4', '2', '.', '1', '8'])), { ok: true, cents: 4218 });
  assert.deepEqual(parseAmountToCents(type(['.'])), { ok: false, error: 'Amount must be more than $0' });
  assert.equal(parseAmountToCents('1000001').ok, false);
});

test('desktop keys map to keypad keys', () => {
  assert.equal(keypadKeyFromKeyboard('7'), '7');
  assert.equal(keypadKeyFromKeyboard(','), '.');
  assert.equal(keypadKeyFromKeyboard('Backspace'), 'backspace');
  assert.equal(keypadKeyFromKeyboard('a'), null);
});

test('display adds thousands separators and keeps typed decimals', () => {
  assert.equal(formatKeypadAmount('1234567.5'), '1,234,567.5');
  assert.equal(formatKeypadAmount('42.'), '42.');
  assert.equal(formatKeypadAmount('0.05'), '0.05');
  assert.equal(formatKeypadAmount(''), '0');
});
