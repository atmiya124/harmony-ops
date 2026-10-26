import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLabourEdit, checkLabourPayment, countsAsCost, countsAsOutlay, formatHours, labourPayState, paidPercent, labourSummaryLabel, lineAmountCents, parseHours, summarizeLabour, totalPayState } from './labour';

test('parseHours accepts decimal and clock forms', () => {
  assert.deepEqual(parseHours('6.5'), { ok: true, minutes: 390 });
  assert.deepEqual(parseHours('6,5'), { ok: true, minutes: 390 });
  assert.deepEqual(parseHours('6:30'), { ok: true, minutes: 390 });
  assert.deepEqual(parseHours('6h30'), { ok: true, minutes: 390 });
  assert.deepEqual(parseHours(' 8 '), { ok: true, minutes: 480 });
  assert.deepEqual(parseHours('8h'), { ok: true, minutes: 480 });
  assert.deepEqual(parseHours('.75'), { ok: true, minutes: 45 });
  assert.deepEqual(parseHours('7:'), { ok: true, minutes: 420 });
  assert.deepEqual(parseHours('3'), { ok: true, minutes: 180 });
  assert.deepEqual(parseHours('11:45'), { ok: true, minutes: 705 });
});

test('parseHours rejects nonsense, zero and over a day', () => {
  for (const bad of ['', 'abc', '0', '0:00', '6:75', '25', '24:01', '-3', '1.234']) {
    assert.equal(parseHours(bad).ok, false, bad);
  }
  assert.equal(parseHours('24').ok, true);
});

test('line amount is minutes × hourly rate, rounded to the cent', () => {
  assert.equal(lineAmountCents(390, 2500), 16250); // 6.5 h × $25
  assert.equal(lineAmountCents(400, 2250), 15000); // 6:40 × $22.50
  assert.equal(lineAmountCents(7, 1999), 233); // 233.21… → 233
});

test('summary totals people, hours and money', () => {
  const s = summarizeLabour([
    { minutes: 390, rateCents: 2500 },
    { minutes: 390, rateCents: 2500 },
    { minutes: 390, rateCents: 2200 },
  ]);
  assert.deepEqual(s, { people: 3, minutes: 1170, amountCents: 16250 + 16250 + 14300 });
  assert.equal(labourSummaryLabel(s), '3 people · 19.5 h');
  assert.equal(labourSummaryLabel({ people: 1, minutes: 400 }), '1 person · 6:40 h');
});

test('formatHours reads naturally', () => {
  assert.equal(formatHours(480), '8');
  assert.equal(formatHours(390), '6.5');
  assert.equal(formatHours(405), '6.75');
  assert.equal(formatHours(402), '6.7');
  assert.equal(formatHours(401), '6:41');
});

test('pay state is derived from earned and live payments', () => {
  assert.deepEqual(labourPayState(20000, []), { earnedCents: 20000, paidCents: 0, remainingCents: 20000, status: 'unpaid' });
  assert.deepEqual(labourPayState(20000, [{ amountCents: 5000 }, { amountCents: 3000 }]), { earnedCents: 20000, paidCents: 8000, remainingCents: 12000, status: 'partial' });
  assert.equal(labourPayState(20000, [{ amountCents: 20000 }]).status, 'paid');
  // A removed payment no longer counts.
  assert.equal(labourPayState(20000, [{ amountCents: 20000, deletedAt: '2026-10-20T00:00:00Z' }]).status, 'unpaid');
  // Paid → partially paid when hours are added later.
  assert.deepEqual(labourPayState(25000, [{ amountCents: 20000 }]), { earnedCents: 25000, paidCents: 20000, remainingCents: 5000, status: 'partial' });
  const total = totalPayState([labourPayState(20000, [{ amountCents: 20000 }]), labourPayState(10000, [])]);
  assert.deepEqual(total, { earnedCents: 30000, paidCents: 20000, remainingCents: 10000, status: 'partial' });
});

test('payments settle what is owed, never more', () => {
  assert.deepEqual(checkLabourPayment(labourPayState(20000, [{ amountCents: 15000 }]), 5000), { ok: true });
  assert.equal(checkLabourPayment(labourPayState(20000, [{ amountCents: 15000 }]), 5001).ok, false);
  assert.equal(checkLabourPayment(labourPayState(20000, [{ amountCents: 20000 }]), 1).ok, false);
});

test('edits: hours may grow; paid people stay and never drop below paid', () => {
  const existing = [
    { id: 'm', workerName: 'Mike', paidCents: 20000 },
    { id: 's', workerName: 'Sam', paidCents: 0 },
  ];
  assert.deepEqual(checkLabourEdit(existing, [{ id: 'm', minutes: 600, rateCents: 2500 }]), { ok: true }); // Sam removed: fine
  assert.equal(checkLabourEdit(existing, [{ id: 's', minutes: 60, rateCents: 2500 }]).ok, false); // Mike removed
  assert.equal(checkLabourEdit(existing, [{ id: 'm', minutes: 479, rateCents: 2500 }]).ok, false); // below $200
  assert.deepEqual(checkLabourEdit(existing, [{ id: 'm', minutes: 480, rateCents: 2500 }]), { ok: true }); // exactly paid
});

test('labour counts as cost, crew payments as outlay — never both', () => {
  const rows = [{ kind: 'expense' as const }, { kind: 'labour' as const }, { kind: 'labour_payment' as const }];
  assert.deepEqual(rows.filter(countsAsCost).map((r) => r.kind), ['expense', 'labour']);
  assert.deepEqual(rows.filter(countsAsOutlay).map((r) => r.kind), ['expense', 'labour_payment']);
});

test('paidPercent rounds down and only reads 100 once fully paid', () => {
  assert.equal(paidPercent({ earnedCents: 20000, paidCents: 0 }), 0);
  assert.equal(paidPercent({ earnedCents: 20000, paidCents: 8000 }), 40);
  assert.equal(paidPercent({ earnedCents: 20000, paidCents: 19999 }), 99);
  assert.equal(paidPercent({ earnedCents: 100000, paidCents: 1 }), 1);
  assert.equal(paidPercent({ earnedCents: 20000, paidCents: 20000 }), 100);
});
