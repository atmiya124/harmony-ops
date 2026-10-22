'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronRight, Receipt } from 'lucide-react';
import RangeTabs from '@/components/charts/RangeTabs';
import ExpenseRow from '@/components/expenses/ExpenseRow';
import { partnerLabel } from '@/components/expenses/partnerLabel';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import ErrorState from '@/components/ui/ErrorState';
import { useCachedData } from '@/hooks/useCachedData';
import { DASHBOARD_EXPENSES_FILTER, expensesKey, FINANCE_PARTNERS_KEY, getPartners, listExpenses, type ExpenseDto } from '@/lib/financeApi';
import { currentPeriod, inPeriod, isMonthRange, monthsSince, rangeFromParam, rangeLabel, rangeToParam, type DateRange } from '@/lib/dateRanges';
import { formatCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';
import { countsAsCost } from '@/lib/finance/labour';

interface EventGroup {
  key: string;
  bookingId: number | null;
  title: string;
  eventDate: string | null;
  cents: number;
  expenses: ExpenseDto[];
}

// "Event expenses" from the Finances card: what was spent on events in the
// period, grouped by event (most spent first), each with its expenses and a
// way into the booking. Uses the same expenses the Finances tab loaded.
export default function EventExpenses({ initialRange }: { initialRange: string | null }) {
  const router = useRouter();
  const today = todayLocal();
  const { version } = useExpenseEntry();
  const [range, setRange] = useState<DateRange>(() => rangeFromParam(initialRange, today));
  const [month, setMonth] = useState(() => (isMonthRange(range) ? range.month : today.slice(0, 7)));
  const expensesData = useCachedData(expensesKey(DASHBOARD_EXPENSES_FILTER), () => listExpenses(DASHBOARD_EXPENSES_FILTER), version);
  const partnersData = useCachedData(FINANCE_PARTNERS_KEY, getPartners, version);
  const expenses = expensesData.data ?? null;
  const nameFor = (email: string) => {
    const p = partnersData.data?.partners.find((x) => x.email === email);
    return p ? partnerLabel(p) : email.split('@')[0];
  };

  const view = useMemo(() => {
    if (!expenses) return null;
    const period = currentPeriod(range, today);
    const groups = new Map<string, EventGroup>();
    for (const e of expenses) {
      // Cost only: crew labour counts once, not again as its payments.
      if (e.bookingId === null || !countsAsCost(e) || !inPeriod(e.expenseDate, period)) continue;
      const key = String(e.bookingId);
      const g = groups.get(key) ?? {
        key,
        bookingId: e.booking ? e.booking.id : null,
        title: e.booking?.title || (e.bookingDeleted ? 'Deleted event' : 'Untitled event'),
        eventDate: e.booking?.eventDate ?? null,
        cents: 0,
        expenses: [],
      };
      g.cents += e.amountCents;
      g.expenses.push(e);
      groups.set(key, g);
    }
    const list = [...groups.values()].sort((a, b) => b.cents - a.cents);
    for (const g of list) g.expenses.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
    return { groups: list, total: list.reduce((s, g) => s + g.cents, 0), count: list.reduce((s, g) => s + g.expenses.length, 0) };
  }, [expenses, range, today]);

  const earliest = expenses?.reduce((min, e) => (e.expenseDate < min ? e.expenseDate : min), today) ?? today;

  function changeRange(next: DateRange) {
    setRange(next);
    if (isMonthRange(next)) setMonth(next.month);
    // Keep the address in step, so Back and a refresh show the same period.
    router.replace(`/finances/events?range=${rangeToParam(next)}`, { scroll: false });
  }

  return (
    <div className="space-y-4 pb-6">
      <RangeTabs value={range} month={month} months={monthsSince(earliest, today)} today={today} onChange={changeRange} />

      {expensesData.error && !expenses ? (
        <ErrorState message={expensesData.error} />
      ) : !view ? (
        <div className="h-40 animate-pulse rounded-3xl bg-white/[0.03]" aria-busy="true" />
      ) : (
        <>
          <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
            <p className="text-sm text-[var(--flat-text-faint)]">Spent on events · {rangeLabel(range)}</p>
            <p className="mt-1 text-[40px] font-bold leading-tight tracking-tight tabular-nums text-white">{formatCents(view.total)}</p>
            <p className="mt-1 text-xs text-[var(--flat-text-faint)]">
              {view.groups.length} event{view.groups.length === 1 ? '' : 's'} · {view.count} expense{view.count === 1 ? '' : 's'}
            </p>
          </section>

          {view.groups.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] py-10 text-center">
              <Receipt size={22} className="text-[var(--flat-text-ghost)]" />
              <p className="text-sm text-[var(--flat-text-faint)]">No event expenses · {rangeLabel(range)}</p>
            </div>
          ) : (
            view.groups.map((g) => (
              <section key={g.key} className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-bold text-white">{g.title}</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--flat-text-faint)]">
                      {g.eventDate ? (
                        <>
                          <CalendarDays size={12} /> {friendlyDate(g.eventDate, today)} ·{' '}
                        </>
                      ) : null}
                      {g.expenses.length} expense{g.expenses.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="shrink-0 text-[17px] font-bold tabular-nums text-white">{formatCents(g.cents)}</p>
                </div>
                {g.bookingId !== null ? (
                  <Link href={`/events/bookings/${g.bookingId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--neon-cyan)]">
                    Open booking <ChevronRight size={14} />
                  </Link>
                ) : null}
                <ul className="mt-1 divide-y divide-[var(--flat-border)]">
                  {g.expenses.map((e) => (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      // Labour wasn't paid by whoever entered it, so no partner name.
                      details={e.kind === 'labour' ? friendlyDate(e.expenseDate, today) : `${friendlyDate(e.expenseDate, today)} · ${nameFor(e.paidByEmail)}`}
                      amount={formatCents(e.amountCents)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
