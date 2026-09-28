'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Paperclip, Receipt } from 'lucide-react';
import { CATEGORY_META } from './categoryMeta';
import { useExpenseEntry } from './ExpenseEntryProvider';
import { colorAlpha } from '@/lib/colorAlpha';
import { listExpenses, type ExpenseDto, type ExpenseListFilter } from '@/lib/financeApi';
import { formatCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';
import { REIMBURSEMENT_STATUS_LABELS } from '@/lib/finance/types';

// Expense rows (icon · category · date · event · amount) that open the edit
// sheet when tapped. Re-fetches whenever an expense changes anywhere.
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
  const { version, openEditExpense } = useExpenseEntry();
  const [expenses, setExpenses] = useState<ExpenseDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filterKey = JSON.stringify(filter ?? {});

  useEffect(() => {
    let cancelled = false;
    listExpenses({ ...JSON.parse(filterKey), limit })
      .then((rows) => {
        if (cancelled) return;
        setExpenses(rows);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load expenses'));
    return () => {
      cancelled = true;
    };
  }, [filterKey, limit, version]);

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
        const meta = CATEGORY_META[e.category];
        const Icon = meta.icon;
        const where = e.booking ? e.booking.title : e.bookingDeleted ? 'Deleted event' : 'General';
        const owed = e.reimbursement.status === 'pending' || e.reimbursement.status === 'partial';
        return (
          <li key={e.id}>
            <button type="button" onClick={() => openEditExpense(e.id)} className="flex w-full items-center gap-3 py-3 text-left">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colorAlpha(meta.color, 16) }}>
                <Icon size={19} style={{ color: meta.color }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold text-white">{meta.label}</span>
                  {e.receipt ? <Paperclip size={12} className="shrink-0 text-white/35" aria-label="Has receipt" /> : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[var(--flat-text-faint)]">
                  {friendlyDate(e.expenseDate, today)}
                  {showEvent ? ` · ${where}` : ''}
                  {owed ? ` · ${REIMBURSEMENT_STATUS_LABELS[e.reimbursement.status]}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-bold tabular-nums text-white">{formatCents(e.amountCents)}</span>
              <ChevronRight size={16} className="shrink-0 text-white/30" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
