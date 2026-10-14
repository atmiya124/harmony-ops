'use client';

import { CHART, SERIES } from '@/components/charts/chartTheme';
import CategoryBars from './CategoryBars';
import type { ExpenseCategory } from '@/lib/finance/types';
import { formatCents } from '@/lib/money';

// The two sides of the ring: whose money it was. "Personal" is a partner's
// own money (their card, or their own cash / e-transfer) — what gets paid
// back; "Business" is company money (the company card, or company cash /
// e-transfer). Fixed colors, from the validated chart palette.
const PERSONAL = SERIES.total; // cyan
const BUSINESS = SERIES.company; // green

// A partner's spending at a glance: the total, a ring splitting it into
// personal vs business money, the two amounts, and where it went by
// category (amounts, each bar against the total).
export default function SpendingCard({
  personalCents,
  businessCents,
  byCategory,
}: {
  personalCents: number;
  businessCents: number;
  byCategory: { category: ExpenseCategory; cents: number }[];
}) {
  const total = personalCents + businessCents;
  const personalShare = total > 0 ? personalCents / total : 0;
  const personalPct = Math.round(personalShare * 100);
  const pctLabel = personalShare > 0 && personalShare < 0.01 ? '<1%' : personalShare > 0.99 && personalShare < 1 ? '>99%' : `${personalPct}%`;

  return (
    <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-[var(--flat-text-faint)]">Total spent</p>
          <p className="mt-1 truncate text-[40px] font-bold leading-none tabular-nums text-white">{formatCents(total)}</p>
        </div>
        {total > 0 ? <SplitRing share={personalShare} label={pctLabel} /> : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--flat-border)] pt-4">
        <Side color={PERSONAL} label="Personal" note="own money · paid back" cents={personalCents} />
        <Side color={BUSINESS} label="Business" note="company money" cents={businessCents} />
      </div>

      {byCategory.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs text-[var(--flat-text-faint)]">Spend by category</p>
          <CategoryBars data={byCategory} totalCents={total} caption="Spend by category" />
        </div>
      ) : null}
    </section>
  );
}

function Side({ color, label, note, cents }: { color: string; label: string; note: string; cents: number }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-[var(--flat-text-faint)]">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        {label}
      </p>
      <p className="mt-1 truncate text-[20px] font-bold tabular-nums text-white">{formatCents(cents)}</p>
      <p className="truncate text-[11px] text-[var(--flat-text-faint)]">{note}</p>
    </div>
  );
}

// Two arcs on one ring — personal from 12 o'clock clockwise, business the
// rest — with a 2px surface gap at each join. The middle names the
// personal share; the amounts beside it carry the exact figures.
function SplitRing({ share, label }: { share: number; label: string }) {
  const size = 92;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const both = share > 0 && share < 1;
  const gap = both ? 3 : 0; // ≈2px at the ring's inner edge
  // A real but tiny share still shows as a short arc, never vanishes; the
  // other arc takes the rest of the ring after both gaps.
  const MIN_ARC = 3;
  const room = c - 2 * gap;
  const personalLen = !both ? (share > 0 ? c : 0) : Math.min(room - MIN_ARC, Math.max(MIN_ARC, c * share - gap));
  const businessLen = !both ? (share < 1 ? c : 0) : room - personalLen;
  const arc = (len: number, offset: number, color: string) => (
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
  );
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${label} personal money, the rest business`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CHART.surface} strokeWidth={stroke} />
        {share > 0 ? arc(personalLen, gap / 2, PERSONAL) : null}
        {share < 1 ? arc(businessLen, personalLen + gap * 1.5, BUSINESS) : null}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[17px] font-bold tabular-nums text-white">{label}</span>
        <span className="mt-1 text-[10px] text-[var(--flat-text-faint)]">personal</span>
      </span>
    </div>
  );
}
