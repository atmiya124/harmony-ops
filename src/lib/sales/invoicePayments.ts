// How an invoice's payment figures and status follow from its payments
// (Phase 5). The invoice row stores the results so lists and the PDF can
// read them directly; these functions are the only place they're worked out.

import type { InvoicePaymentKind, InvoiceStatus } from './types';

export interface PaymentForTotals {
  kind: InvoicePaymentKind;
  amountCents: number;
  voidedAt: string | null;
}

export interface InvoicePaymentTotals {
  depositPaidCents: number;
  amountPaidCents: number; // paid beyond the deposit
  paidCents: number; // both together
  balanceDueCents: number;
}

// Live (not voided) payments only. Payments can never take the balance
// below zero — recordPayment refuses an overpayment — so this doesn't clamp.
export function invoicePaymentTotals(totalCents: number, payments: readonly PaymentForTotals[]): InvoicePaymentTotals {
  let depositPaidCents = 0;
  let amountPaidCents = 0;
  for (const p of payments) {
    if (p.voidedAt) continue;
    if (p.kind === 'deposit') depositPaidCents += p.amountCents;
    else amountPaidCents += p.amountCents;
  }
  const paidCents = depositPaidCents + amountPaidCents;
  return { depositPaidCents, amountPaidCents, paidCents, balanceDueCents: totalCents - paidCents };
}

// The status once the payments have changed. Nothing paid leaves where the
// invoice was in its sending life (a draft stays a draft; one that was
// sent goes back to Sent when its payments are undone).
export function invoiceStatusAfterPayments(invoice: { status: InvoiceStatus; sentAt: string | null }, totals: InvoicePaymentTotals): InvoiceStatus {
  if (invoice.status === 'void') return 'void';
  if (totals.balanceDueCents <= 0) return 'paid';
  if (totals.paidCents > 0) return 'partially_paid';
  if (invoice.status === 'partially_paid' || invoice.status === 'paid') return invoice.sentAt ? 'sent' : 'draft';
  return invoice.status;
}

// Why a payment can't be recorded on this invoice, or null if it can.
export function paymentBlocker(invoice: { status: InvoiceStatus; balanceDueCents: number }): string | null {
  if (invoice.status === 'void') return 'This invoice is void, so it can’t take payments.';
  if (invoice.balanceDueCents <= 0) return 'This invoice is paid in full.';
  return null;
}
