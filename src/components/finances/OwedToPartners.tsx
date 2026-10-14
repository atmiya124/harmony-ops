'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import ExpenseRow from '@/components/expenses/ExpenseRow';
import { partnerLabel } from '@/components/expenses/partnerLabel';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import ErrorState from '@/components/ui/ErrorState';
import { useCachedData } from '@/hooks/useCachedData';
import { DASHBOARD_EXPENSES_FILTER, expensesKey, FINANCE_PARTNERS_KEY, getPartners, listExpenses } from '@/lib/financeApi';
import { formatCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';

// "Owed to partners" from the Finances card: who is owed what (each opens
// their page, where they're paid back), then every expense still waiting,
// oldest first. A balance isn't about one month, so this is all-time — the
// same figure the card shows.
export default function OwedToPartners() {
  const today = todayLocal();
  const { version } = useExpenseEntry();
  const expensesData = useCachedData(expensesKey(DASHBOARD_EXPENSES_FILTER), () => listExpenses(DASHBOARD_EXPENSES_FILTER), version);
  const partnersData = useCachedData(FINANCE_PARTNERS_KEY, getPartners, version);
  const expenses = expensesData.data ?? null;
  const partners = partnersData.data?.partners ?? [];
  const nameFor = (email: string) => {
    const p = partners.find((x) => x.email === email);
    return p ? partnerLabel(p) : email.split('@')[0];
  };

  const waiting = useMemo(
    () =>
      (expenses ?? [])
        .filter((e) => e.reimbursement.outstandingCents > 0)
        .sort((a, b) => (a.expenseDate + a.createdAt).localeCompare(b.expenseDate + b.createdAt)),
    [expenses],
  );
  const owedPartners = partners.filter((p) => p.outstandingCents > 0).sort((a, b) => b.outstandingCents - a.outstandingCents);
  const total = waiting.reduce((s, e) => s + e.reimbursement.outstandingCents, 0);
  const error = expensesData.error ?? partnersData.error;

  if (error && !expenses) return <ErrorState message={error} />;
  if (!expenses || !partnersData.data) return <div className="h-40 animate-pulse rounded-3xl bg-white/[0.03]" aria-busy="true" />;

  return (
    <div className="space-y-4 pb-6">
      <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
        <p className="text-sm text-[var(--flat-text-faint)]">Owed to partners · all time</p>
        <p className="mt-1 text-[40px] font-bold leading-tight tracking-tight tabular-nums text-white">{formatCents(total)}</p>
        <p className="mt-1 text-xs text-[var(--flat-text-faint)]">
          {waiting.length === 0 ? 'Everyone is paid up' : `Across ${waiting.length} expense${waiting.length === 1 ? '' : 's'} paid with their own money`}
        </p>
      </section>

      {owedPartners.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] py-10 text-center">
          <CheckCircle2 size={26} className="text-[var(--neon-green)]" />
          <p className="text-sm text-[var(--flat-text-dim)]">All partners are paid up</p>
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
            <p className="mb-1 text-xs text-[var(--flat-text-faint)]">Who&rsquo;s owed · tap to pay back</p>
            <ul className="divide-y divide-[var(--flat-border)]">
              {owedPartners.map((p) => {
                const count = waiting.filter((e) => e.paidByEmail === p.email).length;
                return (
                  <li key={p.email}>
                    <Link href={`/finances/partners/${encodeURIComponent(p.email)}?from=/finances/owed`} className="flex items-center gap-3 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-bold text-white">{partnerLabel(p).charAt(0)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-white">{partnerLabel(p)}</span>
                        <span className="block text-xs text-[var(--flat-text-faint)]">
                          {count} expense{count === 1 ? '' : 's'} waiting
                        </span>
                      </span>
                      <span className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--neon-orange)]">{formatCents(p.outstandingCents)}</span>
                      <ChevronRight size={16} className="shrink-0 text-white/30" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
            <h2 className="mb-1 text-lg font-bold text-white">Waiting to be paid back</h2>
            <p className="text-xs text-[var(--flat-text-faint)]">Oldest first — payments are applied in this order.</p>
            <ul className="mt-1 divide-y divide-[var(--flat-border)]">
              {waiting.map((e) => {
                const where = e.booking ? e.booking.title : e.bookingDeleted ? 'Deleted event' : 'General';
                const partial = e.reimbursement.reimbursedCents > 0;
                return (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    details={`${friendlyDate(e.expenseDate, today)} · ${nameFor(e.paidByEmail)} · ${where}`}
                    amount={formatCents(e.reimbursement.outstandingCents)}
                    amountNote={partial ? `of ${formatCents(e.amountCents)}` : undefined}
                  />
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
