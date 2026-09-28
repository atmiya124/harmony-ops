import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventFinancialsInputSchema, expenseInputSchema, expenseUpdateSchema, financeSettingsInputSchema, isCalendarDate, reimbursementInputSchema, voidInputSchema } from './finance';

const TODAY = '2026-09-28';
const schema = expenseInputSchema(TODAY);
const valid = {
  id: '3f0b8c1e-2d4a-4c6b-9e8f-1a2b3c4d5e6f',
  bookingId: 12,
  category: 'transportation_fuel',
  amountCents: 6500,
  expenseDate: '2026-09-25',
  paidByEmail: '  Alice@Example.com ',
  paymentMethod: 'personal_card',
};

test('minimal quick-entry expense is accepted and completed with defaults', () => {
  const r = schema.safeParse(valid);
  assert.ok(r.success, JSON.stringify(r.error?.issues));
  assert.equal(r.data.paidByEmail, 'alice@example.com');
  assert.equal(r.data.taxCents, 0);
  assert.equal(r.data.fundingSource, 'personal');
  assert.equal(r.data.reimbursable, true);
  assert.equal(r.data.notes, null);
  assert.equal(r.data.receiptAttachmentId, null);
});

test('company card defaults to company money, no reimbursement', () => {
  const r = schema.parse({ ...valid, paymentMethod: 'company_card' });
  assert.equal(r.fundingSource, 'company');
  assert.equal(r.reimbursable, false);
});

test('cash can be marked as company money', () => {
  const r = schema.parse({ ...valid, paymentMethod: 'cash', fundingSource: 'company' });
  assert.equal(r.reimbursable, false);
});

test('general business expense (no event)', () => {
  assert.ok(schema.safeParse({ ...valid, bookingId: null }).success);
});

function issuePaths(input: unknown): string[] {
  const r = schema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
}

test('rejects bad amounts', () => {
  assert.deepEqual(issuePaths({ ...valid, amountCents: 0 }), ['amountCents']);
  assert.deepEqual(issuePaths({ ...valid, amountCents: -100 }), ['amountCents']);
  assert.deepEqual(issuePaths({ ...valid, amountCents: 12.5 }), ['amountCents']);
  assert.deepEqual(issuePaths({ ...valid, amountCents: 100_000_001 }), ['amountCents']);
  assert.deepEqual(issuePaths({ ...valid, amountCents: '6500' }), ['amountCents']);
});

test('rejects HST not less than the total', () => {
  assert.deepEqual(issuePaths({ ...valid, taxCents: 6500 }), ['taxCents']);
});

test('rejects bad dates', () => {
  assert.deepEqual(issuePaths({ ...valid, expenseDate: '2026-02-30' }), ['expenseDate']);
  assert.deepEqual(issuePaths({ ...valid, expenseDate: '28/09/2026' }), ['expenseDate']);
  assert.deepEqual(issuePaths({ ...valid, expenseDate: '2026-09-30' }), ['expenseDate']); // 2 days ahead
  assert.deepEqual(issuePaths({ ...valid, expenseDate: '2024-12-31' }), ['expenseDate']);
  assert.deepEqual(issuePaths({ ...valid, expenseDate: '2026-09-29' }), []); // +1 day slack
});

test('rejects unknown enums and company-paid reimbursements', () => {
  assert.deepEqual(issuePaths({ ...valid, category: 'Fuel' }), ['category']);
  assert.deepEqual(issuePaths({ ...valid, paymentMethod: 'crypto' }), ['paymentMethod']);
  assert.deepEqual(issuePaths({ ...valid, paymentMethod: 'company_card', reimbursable: true }), ['reimbursable']);
  assert.deepEqual(issuePaths({ ...valid, reimbursable: false }), []); // partner waives repayment
});

test('rejects malformed ids, emails, and oversized notes', () => {
  assert.deepEqual(issuePaths({ ...valid, id: '123' }), ['id']);
  assert.deepEqual(issuePaths({ ...valid, paidByEmail: 'alice' }), ['paidByEmail']);
  assert.deepEqual(issuePaths({ ...valid, bookingId: 0 }), ['bookingId']);
  assert.deepEqual(issuePaths({ ...valid, notes: 'x'.repeat(1001) }), ['notes']);
});

test('blank notes are stored as null, text is trimmed', () => {
  assert.equal(schema.parse({ ...valid, notes: '   ' }).notes, null);
  assert.equal(schema.parse({ ...valid, notes: ' Gas for Ganesh Utsav ' }).notes, 'Gas for Ganesh Utsav');
});

test('event financials', () => {
  assert.ok(eventFinancialsInputSchema.safeParse({ agreedAmountCents: 500000, amountStatus: 'confirmed', hstTreatment: 'excluded' }).success);
  assert.ok(eventFinancialsInputSchema.safeParse({ agreedAmountCents: 0, amountStatus: 'estimated', hstTreatment: 'exempt', hstRateBp: 0 }).success);
  assert.equal(eventFinancialsInputSchema.safeParse({ agreedAmountCents: -1, amountStatus: 'confirmed', hstTreatment: 'excluded' }).success, false);
  assert.equal(eventFinancialsInputSchema.safeParse({ agreedAmountCents: 1, amountStatus: 'final', hstTreatment: 'excluded' }).success, false);
  assert.equal(eventFinancialsInputSchema.safeParse({ agreedAmountCents: 1, amountStatus: 'confirmed', hstTreatment: 'excluded', hstRateBp: 3001 }).success, false);
});

test('finance settings', () => {
  assert.ok(financeSettingsInputSchema.safeParse({ hstRegistered: true, defaultHstRateBp: 1300 }).success);
  assert.equal(financeSettingsInputSchema.safeParse({ hstRegistered: 'yes', defaultHstRateBp: 1300 }).success, false);
});

test('calendar dates', () => {
  assert.equal(isCalendarDate('2028-02-29'), true);
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('2026-13-01'), false);
});

test('expense updates need the version the editor loaded, and no id in the body', () => {
  const fields: Partial<typeof valid> = { ...valid };
  delete fields.id;
  const upd = expenseUpdateSchema(TODAY);
  assert.ok(upd.safeParse({ ...fields, expectedUpdatedAt: '2026-09-28T10:00:00.000Z' }).success);
  const missing = upd.safeParse(fields);
  assert.ok(!missing.success && missing.error.issues.some((i) => i.path[0] === 'expectedUpdatedAt'));
});

test('reimbursement payments', () => {
  const rs = reimbursementInputSchema(TODAY);
  const ok = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', amountCents: 30000, reimbursedOn: '2026-09-27', method: 'etransfer' };
  assert.ok(rs.safeParse(ok).success);
  assert.equal(rs.safeParse({ ...ok, amountCents: 0 }).success, false);
  assert.equal(rs.safeParse({ ...ok, amountCents: 300.5 }).success, false);
  assert.equal(rs.safeParse({ ...ok, method: 'paypal' }).success, false);
  assert.equal(rs.safeParse({ ...ok, reimbursedOn: '2026-10-05' }).success, false);
  assert.equal(rs.safeParse({ ...ok, id: 'nope' }).success, false);
});

test('voiding requires a reason', () => {
  assert.ok(voidInputSchema.safeParse({ reason: 'Entered twice' }).success);
  assert.equal(voidInputSchema.safeParse({ reason: '  ' }).success, false);
  assert.equal(voidInputSchema.safeParse({}).success, false);
});
