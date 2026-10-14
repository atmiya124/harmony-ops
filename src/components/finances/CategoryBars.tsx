'use client';

import { CATEGORY_META } from '@/components/expenses/categoryMeta';
import ChartDataTable from '@/components/charts/ChartDataTable';
import type { ExpenseCategory } from '@/lib/finance/types';
import { formatCents } from '@/lib/money';

// Where the money went: one row per category — its color dot and name, a
// track filled to its share of `totalCents`, and the amount. The tracks line
// up (fixed name and amount columns) so the rows compare at a glance.
export default function CategoryBars({ data, totalCents, caption }: { data: { category: ExpenseCategory; cents: number }[]; totalCents: number; caption: string }) {
  return (
    <>
      <ul className="space-y-2.5">
        {data.map((c) => {
          const meta = CATEGORY_META[c.category];
          return (
            <li key={c.category} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_6rem] items-center gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
                <span className="truncate text-[15px] text-white">{meta.short}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
                <span className="block h-full min-w-[3px] rounded-full" style={{ width: `${totalCents > 0 ? (c.cents / totalCents) * 100 : 0}%`, backgroundColor: meta.color }} />
              </span>
              <span className="text-right text-[15px] font-bold tabular-nums text-white">{formatCents(c.cents)}</span>
            </li>
          );
        })}
      </ul>
      <ChartDataTable caption={caption} data={data.map((c) => ({ label: CATEGORY_META[c.category].label, value: c.cents }))} />
    </>
  );
}
