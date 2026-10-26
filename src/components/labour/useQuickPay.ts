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

export function useQuickPay() {
  const { notifyChanged, showToast } = useExpenseEntry();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // `key` marks which row is busy; `lines` are what that row owes (or a
  // loader for them, e.g. a crew member's events).
  const pay = useCallback(
    async (key: string, name: string, lines: PayLine[] | (() => Promise<PayLine[]>)) => {
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
        notifyChanged();
        showToast({
          message: `Paid ${name} ${formatCents(amountCents)} · ${PAYMENT_METHOD_LABELS[how.paymentMethod]}${how.fundingSource === 'personal' ? ' (yours)' : ''}`,
          actionLabel: 'Undo',
          onAction: async () => {
            for (const p of payments) await deleteExpense(p.id);
            notifyChanged();
          },
        });
      } catch (err) {
        showToast({ message: err instanceof Error ? err.message : 'Could not record the payment' });
      } finally {
        setBusyKey(null);
      }
    },
    [notifyChanged, showToast],
  );

  return { pay, busyKey };
}
