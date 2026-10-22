'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus, Users } from 'lucide-react';
import AreaTrend from '@/components/charts/AreaTrend';
import ColumnTrend from '@/components/charts/ColumnTrend';
import CategoryBars from './CategoryBars';
import RangeTabs from '@/components/charts/RangeTabs';
import { ChangeIndicator, ChartCard } from '@/components/charts/ChartCard';
import { SERIES } from '@/components/charts/chartTheme';
import ExpenseList from '@/components/expenses/ExpenseList';
import { partnerLabel } from '@/components/expenses/partnerLabel';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import ErrorState from '@/components/ui/ErrorState';
import { DASHBOARD_EXPENSES_FILTER, expensesKey, FINANCE_PARTNERS_KEY, getPartners, listExpenses } from '@/lib/financeApi';
import { useCachedData } from '@/hooks/useCachedData';
import { accumulate, bucketize, comparedTo, currentPeriod, inPeriod, isMonthRange, monthsSince, previousPeriod, rangeToParam, type DateRange } from '@/lib/dateRanges';
import { formatCents, formatCentsWhole, percentChange } from '@/lib/money';
import { todayLocal } from '@/lib/finance/dates';
import { countsAsCost, countsAsOutlay } from '@/lib/finance/labour';
import { EXPENSE_CATEGORIES } from '@/lib/finance/types';

// The Finances tab: what the company spent over a period, where it went,
// what each partner spent and is owed (each opens their own page). Every
// card follows the range pills. Totals are money out (tax included); reimbursements are payments
// against expenses, never extra spending, so they don't change any total.
// Crew labour counts as cost when its hours are entered; paying the crew
// later only shows in who-paid and owed-to-partner figures (see EXPENSE_KINDS).
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
    const rows = expenses.map((e) => ({ ...e, date: e.expenseDate, cents: e.amountCents }));
    const all = rows.filter(countsAsCost);
    const period = currentPeriod(range, today);
    const previous = previousPeriod(range, today);
    const inRange = all.filter((e) => inPeriod(e.date, period));
    const total = inRange.reduce((s, e) => s + e.cents, 0);
    const previousTotal = previous ? all.filter((e) => inPeriod(e.date, previous)).reduce((s, e) => s + e.cents, 0) : null;

    const eventOnly = all.filter((e) => e.bookingId !== null);
    const owed = rows.filter((e) => e.reimbursement.outstandingCents > 0).map((e) => ({ date: e.date, cents: e.reimbursement.outstandingCents }));

    const byCategory = EXPENSE_CATEGORIES.map((c) => ({
      category: c,
      cents: inRange.filter((e) => e.category === c).reduce((s, e) => s + e.cents, 0),
    }))
      .filter((c) => c.cents > 0)
      .sort((a, b) => b.cents - a.cents);

    // What each partner paid for in the period, split by whose money it was.
    const spentBy = new Map<string, { own: number; company: number }>();
    for (const e of rows.filter((r) => countsAsOutlay(r) && inPeriod(r.date, period))) {
      const s = spentBy.get(e.paidByEmail) ?? { own: 0, company: 0 };
      if (e.fundingSource === 'company') s.company += e.cents;
      else s.own += e.cents;
      spentBy.set(e.paidByEmail, s);
    }

    return {
      total,
      spentBy,
      change: previousTotal === null ? null : percentChange(total, previousTotal),
      months: bucketize(all, '1Y', today),
      eventTotal: inRange.filter((e) => e.bookingId !== null).reduce((s, e) => s + e.cents, 0),
      eventTrend: accumulate(bucketize(eventOnly, range, today)),
      owedTotal: owed.reduce((s, e) => s + e.cents, 0),
      owedTrend: accumulate(bucketize(owed, range, today)),
      byCategory,
      // All crew labour still to be paid, whatever the period.
      crewUnpaidCents: rows.reduce((s, e) => s + (e.labour?.remainingCents ?? 0), 0),
    };
  }, [expenses, range, today]);

  const spentTotal = (email: string) => {
    const s = view?.spentBy.get(email);
    return s ? s.own + s.company : 0;
  };
  // Only partners who spent something this period (most first) — plus anyone
  // still owed money, so their page (and Record payment) stays one tap away.
  const partnersBySpend = partners
    .filter((p) => spentTotal(p.email) > 0 || p.outstandingCents > 0)
    .sort((a, b) => spentTotal(b.email) - spentTotal(a.email) || b.outstandingCents - a.outstandingCents);
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
            <ChartCard title="Event expenses" value={formatCentsWhole(view.eventTotal)} href={`/finances/events?range=${rangeToParam(range)}`}>
              <AreaTrend data={view.eventTrend} color={SERIES.event} label="Event expenses over the period" height={56} />
            </ChartCard>
            <ChartCard title="Owed to partners" value={formatCents(view.owedTotal)} href="/finances/owed">
              <AreaTrend data={view.owedTrend} color={SERIES.reimbursement} label="Outstanding reimbursements by expense date" height={56} />
            </ChartCard>
          </div>

          {/* Crew: one line here; names, rates and history live on the Crew screen. */}
          <Link href="/finances/crew" className="flex items-center gap-3 rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
              <Users size={17} className="text-white/80" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-white">Crew</span>
            {view.crewUnpaidCents > 0 ? (
              <span className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--neon-orange)]">{formatCents(view.crewUnpaidCents)} unpaid</span>
            ) : (
              <span className="shrink-0 text-xs text-[var(--flat-text-faint)]">All paid</span>
            )}
            <ChevronRight size={16} className="shrink-0 text-white/30" />
          </Link>

          {partnersBySpend.length > 0 ? (
            // Each partner opens their own page: history and paying them back.
            <div className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--flat-text-faint)]">Partners · spent this period</p>
              <ul className="divide-y divide-[var(--flat-border)]">
                {partnersBySpend.map((p) => {
                  const spent = view.spentBy.get(p.email) ?? { own: 0, company: 0 };
                  // Still waiting to be paid back: orange, so it stands out from settled partners.
                  const owed = p.outstandingCents > 0;
                  return (
                    <li key={p.email}>
                      <Link href={`/finances/partners/${encodeURIComponent(p.email)}`} className="flex items-center gap-3 py-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            owed ? 'bg-[rgba(251,146,60,0.16)] text-[var(--neon-orange)] ring-1 ring-[rgba(251,146,60,0.45)]' : 'bg-white/[0.08] text-white'
                          }`}
                        >
                          {partnerLabel(p).charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold text-white">{partnerLabel(p)}</span>
                          <span className={`block truncate text-xs ${owed ? 'text-[var(--neon-orange)]' : 'text-[var(--flat-text-faint)]'}`}>
                            {owed ? `${formatCents(p.outstandingCents)} not paid back` : 'All paid back'}
                          </span>
                        </span>
                        <span className="shrink-0 text-[15px] font-bold tabular-nums text-white">{formatCents(spent.own + spent.company)}</span>
                        <ChevronRight size={16} className="shrink-0 text-white/30" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {view.byCategory.length > 0 ? (
            <ChartCard title="By category" value={formatCentsWhole(view.total)}>
              <div className="mt-3">
                <CategoryBars data={view.byCategory} totalCents={view.total} caption="Expenses by category for the period" />
              </div>
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
