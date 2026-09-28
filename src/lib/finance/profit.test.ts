import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEvent } from './profit';

const agreed = { agreedAmountCents: 500000, amountStatus: 'confirmed' as const, hstTreatment: 'excluded' as const, hstRateBp: 1300 };
const exp = (amountCents: number, taxCents = 0, deletedAt: string | null = null) => ({ amountCents, taxCents, deletedAt });

test('profit = pre-tax agreed amount minus expense cost', () => {
  const s = summarizeEvent(agreed, [exp(120000), exp(30000)], false);
  assert.equal(s.agreed?.netCents, 500000);
  assert.equal(s.agreed?.grossCents, 565000);
  assert.equal(s.expensesPaidCents, 150000);
  assert.equal(s.estimatedProfitCents, 350000);
});

test('HST collected from the client is never counted as profit', () => {
  const incl = summarizeEvent({ ...agreed, agreedAmountCents: 565000, hstTreatment: 'included' }, [], false);
  assert.equal(incl.estimatedProfitCents, 500000);
});

test('registered: recoverable HST on expenses is not a cost; not registered: it is', () => {
  const expenses = [exp(11300, 1300)];
  assert.equal(summarizeEvent(agreed, expenses, true).estimatedProfitCents, 490000);
  assert.equal(summarizeEvent(agreed, expenses, false).estimatedProfitCents, 488700);
  // Money out is the same either way.
  assert.equal(summarizeEvent(agreed, expenses, true).expensesPaidCents, 11300);
});

test('deleted expenses are excluded', () => {
  const s = summarizeEvent(agreed, [exp(100000), exp(99999, 0, '2026-09-28T00:00:00Z')], false);
  assert.equal(s.expenseCount, 1);
  assert.equal(s.estimatedProfitCents, 400000);
});

test('no agreed amount -> no profit figure, expenses still totalled', () => {
  const s = summarizeEvent(null, [exp(5000)], false);
  assert.equal(s.agreed, null);
  assert.equal(s.estimatedProfitCents, null);
  assert.equal(s.expensesPaidCents, 5000);
});

test('a loss is reported as a negative profit', () => {
  assert.equal(summarizeEvent({ ...agreed, agreedAmountCents: 10000 }, [exp(25000)], false).estimatedProfitCents, -15000);
});
