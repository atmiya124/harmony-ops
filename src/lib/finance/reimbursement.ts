// Who paid, and what the company still owes them. A reimbursement is a
// payment recorded *against* an expense — never a second expense — so
// paying a partner back can't double-count spending. Partial payments are
// separate rows; the outstanding balance and status are always derived
// from the live (non-voided) payments, never stored.

import { formatCents } from '../money';
import type { FundingSource, PaymentMethod, ReimbursementStatus } from './types';

// Pre-selects whose money it was from the payment method. Only the company
// card is certain; cash and e-transfers default to the partner and can be
// switched to company in the form.
export function defaultFundingSource(method: PaymentMethod): FundingSource {
  return method === 'company_card' ? 'company' : 'personal';
}

// A partner who paid personally is owed the money unless they waive it.
export function defaultReimbursable(source: FundingSource): boolean {
  return source === 'personal';
}

export function isValidReimbursable(source: FundingSource, reimbursable: boolean): boolean {
  return source === 'personal' || !reimbursable;
}

interface PaymentLike {
  amountCents: number;
  voidedAt: string | null;
}

export interface ReimbursementState {
  status: ReimbursementStatus;
  reimbursedCents: number; // sum of live (non-voided) payments
  outstandingCents: number; // still owed to the partner
}

export function reimbursementState(expense: { amountCents: number; reimbursable: boolean }, payments: PaymentLike[]): ReimbursementState {
  const reimbursedCents = payments.reduce((sum, p) => (p.voidedAt ? sum : sum + p.amountCents), 0);
  if (!expense.reimbursable) {
    // Money already paid back on a now-waived expense is still reported,
    // but nothing is outstanding.
    return { status: 'not_required', reimbursedCents, outstandingCents: 0 };
  }
  const outstandingCents = Math.max(0, expense.amountCents - reimbursedCents);
  const status: ReimbursementStatus = reimbursedCents === 0 ? 'pending' : outstandingCents === 0 ? 'reimbursed' : 'partial';
  return { status, reimbursedCents, outstandingCents };
}

export type ReimbursementCheck = { ok: true } | { ok: false; error: string };

// Can `amountCents` be paid back against this expense right now?
export function checkNewReimbursement(
  expense: { amountCents: number; reimbursable: boolean; deletedAt: string | null },
  payments: PaymentLike[],
  amountCents: number,
): ReimbursementCheck {
  if (expense.deletedAt) return { ok: false, error: 'This expense has been deleted' };
  if (!expense.reimbursable) return { ok: false, error: 'This expense is not reimbursable' };
  const { outstandingCents } = reimbursementState(expense, payments);
  if (outstandingCents === 0) return { ok: false, error: 'This expense is already fully reimbursed' };
  if (amountCents > outstandingCents) return { ok: false, error: `Only ${formatCents(outstandingCents)} is outstanding` };
  return { ok: true };
}

// Can the expense be edited to this new shape without contradicting the
// payments already made? (Lowering the amount below what was paid back, or
// making it non-reimbursable/company money after a payment, would.)
export function checkExpenseChangeAgainstPayments(
  next: { amountCents: number; reimbursable: boolean },
  payments: PaymentLike[],
): ReimbursementCheck {
  const reimbursedCents = payments.reduce((sum, p) => (p.voidedAt ? sum : sum + p.amountCents), 0);
  if (reimbursedCents === 0) return { ok: true };
  if (!next.reimbursable) {
    return { ok: false, error: 'This expense has reimbursement payments. Void them before marking it company-paid or not reimbursable.' };
  }
  if (next.amountCents < reimbursedCents) {
    return { ok: false, error: `The amount can't be lower than the ${formatCents(reimbursedCents)} already reimbursed.` };
  }
  return { ok: true };
}

interface ExpenseWithPayments {
  paidByEmail: string;
  amountCents: number;
  reimbursable: boolean;
  deletedAt: string | null;
  payments: PaymentLike[];
}

// What the company owes each partner right now, keyed by lower-cased
// email. Partial payments reduce the balance; deleted expenses are ignored.
export function outstandingByPartner(expenses: ExpenseWithPayments[]): Map<string, number> {
  const owed = new Map<string, number>();
  for (const e of expenses) {
    if (e.deletedAt) continue;
    const { outstandingCents } = reimbursementState(e, e.payments);
    if (outstandingCents === 0) continue;
    const key = e.paidByEmail.toLowerCase();
    owed.set(key, (owed.get(key) ?? 0) + outstandingCents);
  }
  return owed;
}
