'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import AreaTrend from '@/components/charts/AreaTrend';
import ColumnTrend from '@/components/charts/ColumnTrend';
import BreakdownBars from '@/components/charts/BreakdownBars';
import RangeTabs from '@/components/charts/RangeTabs';
import { ChangeIndicator, ChartCard } from '@/components/charts/ChartCard';
import { SERIES } from '@/components/charts/chartTheme';
import ExpenseList from '@/components/expenses/ExpenseList';
import { CATEGORY_META } from '@/components/expenses/categoryMeta';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import ErrorState from '@/components/ui/ErrorState';
import { DASHBOARD_EXPENSES_FILTER, expensesKey, FINANCE_PARTNERS_KEY, getPartners, listExpenses } from '@/lib/financeApi';
import { useCachedData } from '@/hooks/useCachedData';
import { accumulate, bucketize, comparedTo, currentPeriod, inPeriod, isMonthRange, monthsSince, previousPeriod, type DateRange } from '@/lib/dateRanges';
import { formatCents, formatCentsWhole, percentChange } from '@/lib/money';
import { todayLocal } from '@/lib/finance/dates';
import { EXPENSE_CATEGORIES } from '@/lib/finance/types';

// The Finances tab: what the company spent over a period, where it went,
// and what's still owed back to partners. Every card follows the range
// pills. Totals are money out (tax included); reimbursements are payments
// against expenses, never extra spending, so they don't change any total.
export default function FinancesDashboard() {
  const { version, openNewExpense } = useExpenseEntry();
  const [range, setRange] = useState<DateRange>(() => ({ month: todayLocal().slice(0, 7) }));
  // The month the picker shows, kept while a preset (3M, YTD…) is active.
  const [month, setMonth] = useState(() => todayLocal().slice(0, 7));
  const [showAll, setShowAll] = useState(false);
  const today = todayLocal();

  // Shown at once on a return visit; refreshed on open and after every change.
  const expensesData = useCachedData(expensesKey(DASHBOARD_EXPENSES_FILTER), () => listExpenses(DASHBOARD_EXPENSES_FILTER), version);
  const partnersData = useCachedData(FINANCE_PARTNERS_KEY, getPartners, version);
  const expenses = expensesData.data ?? null;
  const partners = partnersData.data?.partners ?? [];
  const error = expensesData.error ?? partnersData.error;

  const view = useMemo(() => {
    if (!expenses) return null;
    const all = expenses.map((e) => ({ ...e, date: e.expenseDate, cents: e.amountCents }));
    const period = currentPeriod(range, today);
    const previous = previousPeriod(range, today);
    const inRange = all.filter((e) => inPeriod(e.date, period));
    const total = inRange.reduce((s, e) => s + e.cents, 0);
    const previousTotal = previous ? all.filter((e) => inPeriod(e.date, previous)).reduce((s, e) => s + e.cents, 0) : null;

    const eventOnly = all.filter((e) => e.bookingId !== null);
    const owed = all.filter((e) => e.reimbursement.outstandingCents > 0).map((e) => ({ date: e.date, cents: e.reimbursement.outstandingCents }));

    const byCategory = EXPENSE_CATEGORIES.map((c) => ({
      label: CATEGORY_META[c].label,
      value: inRange.filter((e) => e.category === c).reduce((s, e) => s + e.cents, 0),
    }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      total,
      change: previousTotal === null ? null : percentChange(total, previousTotal),
      months: bucketize(all, '1Y', today),
      eventTotal: inRange.filter((e) => e.bookingId !== null).reduce((s, e) => s + e.cents, 0),
      eventTrend: accumulate(bucketize(eventOnly, range, today)),
      owedTotal: owed.reduce((s, e) => s + e.cents, 0),
      owedTrend: accumulate(bucketize(owed, range, today)),
      byCategory,
    };
  }, [expenses, range, today]);

  const owedPartners = partners.filter((p) => p.outstandingCents > 0).sort((a, b) => b.outstandingCents - a.outstandingCents);
  const rangeComparedTo = comparedTo(range, today);
  // From the first recorded expense up to this month.
  const earliest = expenses?.reduce((min, e) => (e.expenseDate < min ? e.expenseDate : min), today) ?? today;
  const months = monthsSince(earliest, today);
  const monthCaption = new Date(`${today}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      <RangeTabs
        value={range}
        month={month}
        months={months}
        today={today}
        onChange={(next) => {
          setRange(next);
          if (isMonthRange(next)) setMonth(next.month);
        }}
      />

      {error ? (
        <ErrorState message={error} />
      ) : !view ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-40 animate-pulse rounded-3xl bg-white/[0.03]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-36 animate-pulse rounded-3xl bg-white/[0.03]" />
            <div className="h-36 animate-pulse rounded-3xl bg-white/[0.03]" />
          </div>
        </div>
      ) : (
        <>
          <ChartCard
            title="Total expenses"
            value={formatCentsWhole(view.total)}
            size="hero"
            footer={rangeComparedTo ? <ChangeIndicator percent={view.change} comparedTo={rangeComparedTo} upIsGood={false} /> : null}
            aside={<ColumnTrend data={view.months} label="Expenses by month, last 12 months" height={72} caption={monthCaption} />}
          />

          <div className="grid grid-cols-2 gap-3">
            <ChartCard title="Event expenses" value={formatCentsWhole(view.eventTotal)}>
              <AreaTrend data={view.eventTrend} color={SERIES.event} label="Event expenses over the period" height={56} />
            </ChartCard>
            <ChartCard title="Owed to partners" value={formatCents(view.owedTotal)}>
              <AreaTrend data={view.owedTrend} color={SERIES.reimbursement} label="Outstanding reimbursements by expense date" height={56} />
            </ChartCard>
          </div>

          {owedPartners.length > 0 ? (
            <div className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
              <p className="mb-2 text-xs text-[var(--flat-text-faint)]">Pending reimbursements</p>
              <ul className="divide-y divide-[var(--flat-border)]">
                {owedPartners.map((p) => (
                  <li key={p.email} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-white">{p.name ?? p.email.split('@')[0]}</span>
                    <span className="text-sm font-bold tabular-nums text-white">{formatCents(p.outstandingCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {view.byCategory.length > 0 ? (
            <ChartCard title="By category" value={formatCentsWhole(view.total)}>
              <BreakdownBars data={view.byCategory} label="Expenses by category for the period" color={SERIES.total} />
            </ChartCard>
          ) : null}
        </>
      )}

      <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recent expenses</h2>
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[var(--flat-text-dim)]">
            <span className="text-sm">{showAll ? 'Show less' : 'See all'}</span>
          </button>
        </div>
        <ExpenseList limit={showAll ? 500 : 5} emptyText="No expenses recorded yet" />
      </section>

      <button type="button" onClick={() => openNewExpense()} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-[#0a0a0a]">
        <Plus size={20} />
        <span className="text-[16px] font-bold">Add Expense</span>
      </button>
    </div>
  );
}
