import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkExpenseChangeAgainstPayments,
  checkNewReimbursement,
  defaultFundingSource,
  defaultReimbursable,
  isValidReimbursable,
  outstandingByPartner,
  reimbursementState,
} from './reimbursement';
import { summarizeEvent } from './profit';

const pay = (amountCents: number, voidedAt: string | null = null) => ({ amountCents, voidedAt });
const expense500 = { amountCents: 50000, reimbursable: true, deletedAt: null };

test('funding source and reimbursable defaults', () => {
  assert.equal(defaultFundingSource('company_card'), 'company');
  assert.equal(defaultFundingSource('personal_card'), 'personal');
  assert.equal(defaultFundingSource('cash'), 'personal');
  assert.equal(defaultFundingSource('etransfer'), 'personal');
  assert.equal(defaultReimbursable('personal'), true);
  assert.equal(defaultReimbursable('company'), false);
  assert.equal(isValidReimbursable('company', true), false);
  assert.equal(isValidReimbursable('personal', false), true); // partner waived it
});

test('partial reimbursement: $500 spent, $300 back -> $200 outstanding', () => {
  assert.deepEqual(reimbursementState(expense500, [pay(30000)]), { status: 'partial', reimbursedCents: 30000, outstandingCents: 20000 });
});

test('status moves pending -> partial -> reimbursed as payments are recorded', () => {
  assert.equal(reimbursementState(expense500, []).status, 'pending');
  assert.equal(reimbursementState(expense500, [pay(30000)]).status, 'partial');
  assert.deepEqual(reimbursementState(expense500, [pay(30000), pay(20000)]), { status: 'reimbursed', reimbursedCents: 50000, outstandingCents: 0 });
});

test('voided payments stay in history but no longer count', () => {
  const s = reimbursementState(expense500, [pay(30000), pay(20000, '2026-09-28T10:00:00Z')]);
  assert.deepEqual(s, { status: 'partial', reimbursedCents: 30000, outstandingCents: 20000 });
});

test('not reimbursable -> nothing outstanding', () => {
  assert.deepEqual(reimbursementState({ amountCents: 50000, reimbursable: false }, []), { status: 'not_required', reimbursedCents: 0, outstandingCents: 0 });
});

test('new payments cannot exceed what is outstanding', () => {
  assert.deepEqual(checkNewReimbursement(expense500, [pay(30000)], 20000), { ok: true });
  const over = checkNewReimbursement(expense500, [pay(30000)], 20001);
  assert.ok(!over.ok && over.error.includes('200.00'));
  const full = checkNewReimbursement(expense500, [pay(50000)], 1);
  assert.ok(!full.ok && full.error.includes('fully'));
  assert.equal(checkNewReimbursement({ ...expense500, reimbursable: false }, [], 100).ok, false);
  assert.equal(checkNewReimbursement({ ...expense500, deletedAt: '2026-09-28' }, [], 100).ok, false);
  // After voiding a payment, that amount can be paid again.
  assert.equal(checkNewReimbursement(expense500, [pay(50000, '2026-09-28')], 50000).ok, true);
});

test('editing an expense cannot contradict payments already made', () => {
  assert.equal(checkExpenseChangeAgainstPayments({ amountCents: 30000, reimbursable: true }, [pay(30000)]).ok, true);
  assert.equal(checkExpenseChangeAgainstPayments({ amountCents: 29999, reimbursable: true }, [pay(30000)]).ok, false);
  assert.equal(checkExpenseChangeAgainstPayments({ amountCents: 50000, reimbursable: false }, [pay(30000)]).ok, false);
  assert.equal(checkExpenseChangeAgainstPayments({ amountCents: 100, reimbursable: false }, [pay(30000, 'voided')]).ok, true);
  assert.equal(checkExpenseChangeAgainstPayments({ amountCents: 100, reimbursable: false }, []).ok, true);
});

test('outstanding per partner sums partial balances', () => {
  const owed = outstandingByPartner([
    { paidByEmail: 'Alice@x.com', amountCents: 50000, reimbursable: true, deletedAt: null, payments: [pay(30000)] }, // 200 owed
    { paidByEmail: 'alice@x.com', amountCents: 6500, reimbursable: true, deletedAt: null, payments: [] }, // 65 owed
    { paidByEmail: 'alice@x.com', amountCents: 1000, reimbursable: true, deletedAt: null, payments: [pay(1000)] }, // settled
    { paidByEmail: 'bob@x.com', amountCents: 30000, reimbursable: false, deletedAt: null, payments: [] }, // company / waived
    { paidByEmail: 'bob@x.com', amountCents: 2000, reimbursable: true, deletedAt: '2026-09-01', payments: [] }, // deleted
  ]);
  assert.deepEqual([...owed.entries()], [['alice@x.com', 26500]]);
});

test('reimbursing a partner never changes what the event cost', () => {
  const agreed = { agreedAmountCents: 100000, amountStatus: 'confirmed' as const, hstTreatment: 'exempt' as const, hstRateBp: 1300 };
  const spend = [{ amountCents: 50000, taxCents: 0, deletedAt: null }];
  const s = summarizeEvent(agreed, spend, false);
  assert.equal(s.expensesPaidCents, 50000);
  assert.equal(s.estimatedProfitCents, 50000);
  // Reimbursements are not inputs to the event summary at all — by design.
});
