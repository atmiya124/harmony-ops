'use client';

import { Receipt } from 'lucide-react';
import ExpenseRow from './ExpenseRow';
import { useExpenseEntry } from './ExpenseEntryProvider';
import { expensesKey, listExpenses, type ExpenseListFilter } from '@/lib/financeApi';
import { useCachedData } from '@/hooks/useCachedData';
import { formatCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';
import { REIMBURSEMENT_STATUS_LABELS } from '@/lib/finance/types';

// Expense rows (icon · category · date · event · amount) that open the
// expense's details when tapped. Re-fetches whenever an expense changes
// anywhere.
export default function ExpenseList({
  filter,
  limit,
  emptyText = 'No expenses yet',
  showEvent = true,
}: {
  filter?: ExpenseListFilter;
  limit?: number;
  emptyText?: string;
  showEvent?: boolean;
}) {
  const { version } = useExpenseEntry();
  // Spending lists: crew labour shows once, as its event's cost; payments to
  // crew are inside it, not extra rows.
  const query: ExpenseListFilter = { view: 'cost', ...filter, limit };
  const { data, error } = useCachedData(expensesKey(query), () => listExpenses(query), version);
  const expenses = data ?? null;

  if (error) return <p className="py-3 text-center text-xs text-[var(--neon-pink)]">{error}</p>;
  if (!expenses) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.03]" />
        ))}
      </div>
    );
  }
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-5 text-center">
        <Receipt size={22} className="text-[var(--flat-text-ghost)]" />
        <p className="text-xs text-[var(--flat-text-faint)]">{emptyText}</p>
      </div>
    );
  }

  const today = todayLocal();
  return (
    <ul className="divide-y divide-[var(--flat-border)]">
      {expenses.map((e) => {
        const where = e.booking ? e.booking.title : e.bookingDeleted ? 'Deleted event' : 'General';
        const owed = e.reimbursement.status === 'pending' || e.reimbursement.status === 'partial';
        const details = `${friendlyDate(e.expenseDate, today)}${showEvent ? ` · ${where}` : ''}${owed ? ` · ${REIMBURSEMENT_STATUS_LABELS[e.reimbursement.status]}` : ''}`;
        return <ExpenseRow key={e.id} expense={e} details={details} amount={formatCents(e.amountCents)} />;
      })}
    </ul>
  );
}
