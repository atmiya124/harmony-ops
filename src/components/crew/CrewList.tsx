'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Search, Users } from 'lucide-react';
import CrewFormSheet from './CrewFormSheet';
import PaidButton from '@/components/labour/PaidButton';
import { useQuickPay } from '@/components/labour/useQuickPay';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import ErrorState from '@/components/ui/ErrorState';
import { useCachedData } from '@/hooks/useCachedData';
import { CREW_KEY, CREW_ONE_OFFS_KEY, getCrewMember, getUnpaidOneOffs, listCrew, type CrewMemberDto, type CrewWorkDto } from '@/lib/financeApi';
import { formatCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';

// The crew / contractor directory: who they are, their usual rate, and
// whether they're still owed anything. A row opens their profile; Paid on
// an owed row settles it in one tap (with Undo).
export default function CrewList() {
  const router = useRouter();
  const { version, notifyChanged } = useExpenseEntry();
  const { data: crew, error } = useCachedData(CREW_KEY, listCrew, version);
  const oneOffsData = useCachedData(CREW_ONE_OFFS_KEY, getUnpaidOneOffs, version).data;
  const oneOffs = useMemo(() => oneOffsData ?? [], [oneOffsData]);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const { pay, unpay, busyKey, quickPaid, quickPaidRows } = useQuickPay();
  const today = todayLocal();

  const inactiveCount = (crew ?? []).filter((c) => !c.active).length;
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (crew ?? [])
      .filter((c) => c.active !== showInactive)
      .filter((c) => {
        const haystack = [c.name, c.role, c.company, c.phone, c.email].filter(Boolean).join(' ').toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
  }, [crew, query, showInactive]);
  // One-offs paid with a tap stay listed (green, undoable) until the app is
  // reopened, though they're no longer owed.
  const paidOneOffs = quickPaidRows<CrewWorkDto>().filter((r) => !oneOffs.some((w) => w.lineId === r.lineId));
  const oneOffWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shownOneOffs = showInactive
    ? []
    : [...oneOffs, ...paidOneOffs].filter((w) => oneOffWords.every((word) => `${w.workerName} ${w.booking?.title ?? ''}`.toLowerCase().includes(word)));
  // Everyone still owed: crew on the list and one-off people alike.
  const owedTotal = (crew ?? []).reduce((s, c) => s + c.totals.remainingCents, 0) + oneOffs.reduce((s, w) => s + w.remainingCents, 0);

  if (error && !crew) return <ErrorState message={error} />;
  if (!crew) return <div className="h-40 animate-pulse rounded-3xl bg-white/[0.03]" aria-busy="true" />;

  return (
    <div className="space-y-4 pb-6">
      {owedTotal > 0 ? (
        <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
          <p className="text-sm text-[var(--flat-text-faint)]">Owed to crew</p>
          <p className="mt-1 text-[40px] font-bold leading-tight tracking-tight tabular-nums text-[var(--neon-orange)]">{formatCents(owedTotal)}</p>
        </section>
      ) : null}

      {crew.length > 0 || oneOffs.length > 0 ? (
        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              aria-label="Search crew"
              placeholder="Search name, role, phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-[var(--flat-border)] bg-white/[0.04] py-2.5 pl-10 pr-4 text-base text-white outline-none placeholder:text-[var(--flat-text-faint)]"
            />
          </label>
          {inactiveCount > 0 || showInactive ? (
            <button
              type="button"
              aria-pressed={showInactive}
              onClick={() => setShowInactive((v) => !v)}
              className={`shrink-0 rounded-full border px-3.5 py-2.5 text-xs font-bold ${showInactive ? 'border-white/40 bg-white/[0.1] text-white' : 'border-[var(--flat-border)] text-[var(--flat-text-dim)]'}`}
            >
              <span className="text-xs font-bold">Inactive · {inactiveCount}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {crew.length === 0 && oneOffs.length > 0 ? null : crew.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] px-6 py-12 text-center">
          <Users size={26} className="text-[var(--flat-text-ghost)]" />
          <p className="text-[15px] font-bold text-white">No crew yet</p>
          <p className="max-w-xs text-xs text-[var(--flat-text-faint)]">Add the people you hire by the hour, or add them while entering labour on an event.</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="px-1 text-sm text-[var(--flat-text-faint)]">{query.trim() ? `No crew match “${query.trim()}”.` : showInactive ? 'No inactive crew.' : 'Everyone is inactive.'}</p>
      ) : (
        <ul className="divide-y divide-[var(--flat-border)] rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] px-4">
          {shown.map((c) => (
            <CrewRow
              key={c.id}
              member={c}
              busy={busyKey === c.id}
              disabled={busyKey !== null}
              quickPaidCents={quickPaid(c.id)?.amountCents ?? null}
              onPay={() => pay(c.id, c.name, async () => (await getCrewMember(c.id)).work)}
              onUnpay={() => unpay(c.id, c.name)}
            />
          ))}
        </ul>
      )}

      {shownOneOffs.length > 0 ? (
        // People typed in on an event without a profile, while they're owed.
        <section>
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">One-off · not on the crew list</p>
          <ul className="divide-y divide-[var(--flat-border)] rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] px-4">
            {shownOneOffs.map((w) => {
              const paid = quickPaid(w.lineId);
              return (
              <li key={w.lineId} className="flex items-center gap-2">
                <Link href={`/expenses/${w.labourExpenseId}?from=/finances/crew`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-bold text-white">{w.workerName.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-white">{w.workerName}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--flat-text-faint)]">
                      {[w.booking?.title ?? 'Deleted event', friendlyDate(w.workedOn, today)].join(' · ')}
                    </span>
                  </span>
                  <AmountState cents={paid ? paid.amountCents : w.remainingCents} paid={!!paid} />
                </Link>
                <PaidButton
                  paid={!!paid}
                  busy={busyKey === w.lineId}
                  disabled={busyKey !== null}
                  onPay={() => pay(w.lineId, w.workerName, [w], w)}
                  onUnpay={() => unpay(w.lineId, w.workerName)}
                  name={w.workerName}
                />
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-[#0a0a0a]">
        <Plus size={20} />
        <span className="text-[16px] font-bold">Add crew</span>
      </button>

      {adding ? (
        <CrewFormSheet
          onClose={() => setAdding(false)}
          onSaved={(saved) => {
            setAdding(false);
            notifyChanged();
            router.push(`/finances/crew/${saved.id}`);
          }}
        />
      ) : null}
    </div>
  );
}

// What a row owes (orange) or, once paid with a tap, what was paid (green).
function AmountState({ cents, paid }: { cents: number; paid: boolean }) {
  return (
    <span className="shrink-0 text-right">
      <span className={`block text-[15px] font-bold tabular-nums ${paid ? 'text-[var(--neon-green)]' : 'text-[var(--neon-orange)]'}`}>{formatCents(cents)}</span>
      <span className="block text-[11px] text-[var(--flat-text-faint)]">{paid ? 'paid' : 'owed'}</span>
    </span>
  );
}

function CrewRow({
  member: c,
  busy,
  disabled,
  quickPaidCents,
  onPay,
  onUnpay,
}: {
  member: CrewMemberDto;
  busy: boolean;
  disabled: boolean;
  quickPaidCents: number | null; // paid with a tap this session
  onPay: () => void;
  onUnpay: () => void;
}) {
  const paid = quickPaidCents !== null;
  const details = [c.role, c.phone ?? c.email, c.defaultRateCents !== null ? `${formatCents(c.defaultRateCents)}/h` : null].filter(Boolean).join(' · ');
  return (
    <li className="flex items-center gap-2">
      <Link href={`/finances/crew/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-bold text-white">{c.name.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-white">{c.name}</span>
          {details ? <span className="mt-0.5 block truncate text-xs text-[var(--flat-text-faint)]">{details}</span> : null}
        </span>
        {paid || c.totals.remainingCents > 0 ? (
          <AmountState cents={paid ? quickPaidCents : c.totals.remainingCents} paid={paid} />
        ) : (
          <ChevronRight size={16} className="shrink-0 text-white/30" />
        )}
      </Link>
      {paid || c.totals.remainingCents > 0 ? <PaidButton paid={paid} busy={busy} disabled={disabled} onPay={onPay} onUnpay={onUnpay} name={c.name} /> : null}
    </li>
  );
}
