import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expenseCostCents, formatRate, hstIncluded, hstOnTop, splitAgreedAmount } from './tax';

test('HST on top of a pre-tax amount', () => {
  assert.equal(hstOnTop(10000, 1300), 1300); // $100 -> $13
  assert.equal(hstOnTop(500000, 1300), 65000); // $5,000 -> $650
  assert.equal(hstOnTop(1, 1300), 0); // 0.13¢ rounds down
  assert.equal(hstOnTop(4, 1300), 1); // 0.52¢ rounds up
  assert.equal(hstOnTop(0, 1300), 0);
  assert.equal(hstOnTop(10000, 0), 0);
});

test('HST contained in a tax-inclusive total', () => {
  assert.equal(hstIncluded(11300, 1300), 1300); // $113 -> $13
  assert.equal(hstIncluded(4250, 1300), 489); // $42.50 -> $4.89
  assert.equal(hstIncluded(10000, 1300), 1150); // $100 incl. -> $11.50
  assert.equal(hstIncluded(0, 1300), 0);
});

test('adding HST then extracting it round-trips for every cent up to $100', () => {
  for (let net = 0; net <= 10000; net++) {
    const gross = net + hstOnTop(net, 1300);
    assert.equal(gross - hstIncluded(gross, 1300), net, `net ${net}`);
  }
});

test('splits always add back to the total', () => {
  for (const amount of [1, 99, 4250, 11300, 123457, 100_000_000]) {
    for (const t of ['excluded', 'included', 'exempt'] as const) {
      const s = splitAgreedAmount(amount, t, 1300);
      assert.equal(s.netCents + s.hstCents, s.grossCents, `${t} ${amount}`);
    }
  }
});

test('agreed amount by HST treatment', () => {
  assert.deepEqual(splitAgreedAmount(500000, 'excluded', 1300), { netCents: 500000, hstCents: 65000, grossCents: 565000 });
  assert.deepEqual(splitAgreedAmount(565000, 'included', 1300), { netCents: 500000, hstCents: 65000, grossCents: 565000 });
  assert.deepEqual(splitAgreedAmount(500000, 'exempt', 1300), { netCents: 500000, hstCents: 0, grossCents: 500000 });
});

test('stored rate is honoured (e.g. 15% HST province)', () => {
  assert.equal(hstOnTop(10000, 1500), 1500);
  assert.equal(splitAgreedAmount(11500, 'included', 1500).netCents, 10000);
});

test('expense cost: HST only removed when registered and recorded', () => {
  assert.equal(expenseCostCents(11300, 1300, true), 10000); // registered: HST claimed back
  assert.equal(expenseCostCents(11300, 1300, false), 11300); // not registered: full cost
  assert.equal(expenseCostCents(4250, 0, true), 4250); // no HST recorded: never assumed
});

test('rejects invalid inputs instead of computing nonsense', () => {
  assert.throws(() => hstOnTop(-1, 1300), RangeError);
  assert.throws(() => hstOnTop(10.5, 1300), RangeError);
  assert.throws(() => hstIncluded(100, -1), RangeError);
  assert.throws(() => expenseCostCents(100, 100, true), RangeError);
  assert.throws(() => expenseCostCents(0, 0, true), RangeError);
});

test('rate formatting', () => {
  assert.equal(formatRate(1300), '13%');
  assert.equal(formatRate(1500), '15%');
  assert.equal(formatRate(1250), '12.5%');
  assert.equal(formatRate(0), '0%');
});
