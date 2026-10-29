import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoicePaymentTotals, invoiceStatusAfterPayments, paymentBlocker } from './invoicePayments';

const deposit = (amountCents: number, voidedAt: string | null = null) => ({ kind: 'deposit' as const, amountCents, voidedAt });
const payment = (amountCents: number, voidedAt: string | null = null) => ({ kind: 'payment' as const, amountCents, voidedAt });

test('totals: deposits and later payments are kept apart; voided ones don’t count', () => {
  assert.deepEqual(invoicePaymentTotals(10000, [deposit(3000), payment(2000), payment(500, '2026-10-29T00:00:00Z')]), {
    depositPaidCents: 3000,
    amountPaidCents: 2000,
    paidCents: 5000,
    balanceDueCents: 5000,
  });
  assert.equal(invoicePaymentTotals(10000, []).balanceDueCents, 10000);
});

test('status: partially paid, then paid; undoing goes back to where it was sent from', () => {
  const sent = { status: 'sent' as const, sentAt: '2026-10-20T00:00:00Z' };
  assert.equal(invoiceStatusAfterPayments(sent, invoicePaymentTotals(10000, [payment(4000)])), 'partially_paid');
  assert.equal(invoiceStatusAfterPayments(sent, invoicePaymentTotals(10000, [payment(10000)])), 'paid');
  assert.equal(invoiceStatusAfterPayments({ status: 'paid', sentAt: sent.sentAt }, invoicePaymentTotals(10000, [])), 'sent');
  assert.equal(invoiceStatusAfterPayments({ status: 'partially_paid', sentAt: null }, invoicePaymentTotals(10000, [])), 'draft');
  assert.equal(invoiceStatusAfterPayments({ status: 'draft', sentAt: null }, invoicePaymentTotals(10000, [])), 'draft');
  assert.equal(invoiceStatusAfterPayments({ status: 'void', sentAt: null }, invoicePaymentTotals(10000, [payment(10000)])), 'void');
});

test('no payments on a void or fully paid invoice', () => {
  assert.match(paymentBlocker({ status: 'void', balanceDueCents: 100 })!, /void/);
  assert.match(paymentBlocker({ status: 'paid', balanceDueCents: 0 })!, /paid in full/);
  assert.equal(paymentBlocker({ status: 'partially_paid', balanceDueCents: 100 }), null);
});
