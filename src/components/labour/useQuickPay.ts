'use client';

import { useCallback, useState } from 'react';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import { deleteExpense, FINANCE_PARTNERS_KEY, getPartners, recordLabourPayments } from '@/lib/financeApi';
import { loadCached } from '@/lib/clientCache';
import { formatCents } from '@/lib/money';
import { todayLocal } from '@/lib/finance/dates';
import { PAYMENT_METHOD_LABELS, type FundingSource, type PaymentMethod } from '@/lib/finance/types';

// One-tap "Paid": settles what a person is owed in full, today, paid by
// whoever tapped, with the payment method last used for crew (E-Transfer
// from company money until one is chosen in Record payment). The toast says
// how it was recorded and offers Undo, which removes the payments again.

type PayLine = { lineId: string; remainingCents: number };

const LAST_KEY = 'crew-pay:last';
type How = { paymentMethod: PaymentMethod; fundingSource: FundingSource };
const DEFAULT_HOW: How = { paymentMethod: 'etransfer', fundingSource: 'company' };

export function lastCrewPayHow(): How {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as Partial<How> | null;
    if (v && v.paymentMethod && v.paymentMethod in PAYMENT_METHOD_LABELS && (v.fundingSource === 'company' || v.fundingSource === 'personal')) {
      return { paymentMethod: v.paymentMethod, fundingSource: v.fundingSource };
    }
  } catch {
    // Storage blocked or unreadable: use the default.
  }
  return DEFAULT_HOW;
}

export function rememberCrewPayHow(how: How) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(how));
  } catch {
    // Not remembered; harmless.
  }
}

// Rows paid with one tap since the app was opened, by row key, so a row
// stays green (and can be undone) after the lists refetch — even a one-off
// person who otherwise drops off the "still owed" list.
export interface QuickPaid<T = unknown> {
  paymentIds: string[];
  amountCents: number;
  row?: T; // the row as it was before paying, to keep showing it
}
const paidThisSession = new Map<string, QuickPaid>();

export function useQuickPay() {
  const { notifyChanged, showToast } = useExpenseEntry();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, setPaidVersion] = useState(0);
  const bump = () => setPaidVersion((v) => v + 1);

  const removePayments = useCallback(
    async (key: string, paymentIds: string[]) => {
      for (const id of paymentIds) await deleteExpense(id);
      paidThisSession.delete(key);
      // The same payments may be remembered under another screen's row key.
      for (const [k, v] of paidThisSession) if (v.paymentIds.some((id) => paymentIds.includes(id))) paidThisSession.delete(k);
      bump();
      notifyChanged();
    },
    [notifyChanged],
  );

  // `key` marks the row; `lines` are what that row owes (or a loader for
  // them, e.g. a crew member's events). `row` is kept to show it as paid.
  const pay = useCallback(
    async (key: string, name: string, lines: PayLine[] | (() => Promise<PayLine[]>), row?: unknown) => {
      setBusyKey(key);
      try {
        const owed = (typeof lines === 'function' ? await lines() : lines).filter((l) => l.remainingCents > 0);
        if (owed.length === 0) return;
        const { me } = await loadCached(FINANCE_PARTNERS_KEY, getPartners);
        const how = lastCrewPayHow();
        const payments = owed.map((l) => ({ id: crypto.randomUUID(), lineId: l.lineId, amountCents: l.remainingCents }));
        const { amountCents } = await recordLabourPayments(payments, {
          ...how,
          paidOn: todayLocal(),
          paidByEmail: me,
          reimbursable: how.fundingSource === 'personal',
          reference: null,
          notes: null,
        });
        const paymentIds = payments.map((p) => p.id);
        paidThisSession.set(key, { paymentIds, amountCents, row });
        bump();
        notifyChanged();
        showToast({
          message: `Paid ${name} ${formatCents(amountCents)} · ${PAYMENT_METHOD_LABELS[how.paymentMethod]}${how.fundingSource === 'personal' ? ' (yours)' : ''}`,
          actionLabel: 'Undo',
          onAction: () => removePayments(key, paymentIds),
        });
      } catch (err) {
        showToast({ message: err instanceof Error ? err.message : 'Could not record the payment' });
      } finally {
        setBusyKey(null);
      }
    },
    [notifyChanged, showToast, removePayments],
  );

  // Back to owed: removes the one-tap payments for this row, or — for a row
  // paid some other way — the payments `loadIds` finds.
  const unpay = useCallback(
    async (key: string, name: string, loadIds?: () => Promise<string[]>) => {
      setBusyKey(key);
      try {
        const ids = paidThisSession.get(key)?.paymentIds ?? (loadIds ? await loadIds() : []);
        if (ids.length === 0) return;
        await removePayments(key, ids);
        showToast({ message: `Marked ${name} unpaid` });
      } catch (err) {
        showToast({ message: err instanceof Error ? err.message : 'Could not remove the payment' });
      } finally {
        setBusyKey(null);
      }
    },
    [showToast, removePayments],
  );

  const quickPaid = useCallback((key: string) => paidThisSession.get(key), []);
  const quickPaidRows = useCallback(<T,>(): T[] => [...paidThisSession.values()].map((p) => p.row as T).filter(Boolean), []);

  return { pay, unpay, busyKey, quickPaid, quickPaidRows };
}
