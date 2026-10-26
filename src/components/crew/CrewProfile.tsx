'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Check, ChevronRight, Mail, NotebookText, Phone } from 'lucide-react';
import { PayStatusPill } from '@/components/labour/LabourDetails';
import LabourPaymentSheet from '@/components/labour/LabourPaymentSheet';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import ErrorState from '@/components/ui/ErrorState';
import type { CrewMemberDetailDto } from '@/lib/financeApi';
import { formatCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';
import { formatHours } from '@/lib/finance/labour';

// A crew person's profile: who they are and how to reach them, their usual
// rate, the events they've worked and whether they're still owed money.
// Every event row shows the rate actually used there, which may differ from
// today's default. Paying is two taps: Pay all owed (or tick some events
// first), then confirm who paid and how.
export default function CrewProfile({ member, error }: { member: CrewMemberDetailDto | undefined; error: string | null }) {
  const today = todayLocal();
  const { notifyChanged, showToast } = useExpenseEntry();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [paying, setPaying] = useState(false);
  if (error && !member) return <ErrorState message={error} />;
  if (!member) return <div className="h-40 animate-pulse rounded-3xl bg-white/[0.03]" aria-busy="true" />;
  const t = member.totals;
  const owed = member.work.filter((w) => w.remainingCents > 0);
  // Ticked events still owed (a payment elsewhere may have settled one).
  const ticked = owed.filter((w) => selected.has(w.lineId));
  const toPay = ticked.length > 0 ? ticked : owed;
  const toPayCents = toPay.reduce((s, w) => s + w.remainingCents, 0);
  const allTicked = owed.length > 0 && ticked.length === owed.length;
  const toggle = (lineId: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });

  return (
    <div className="space-y-4 pb-6">
      <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xl font-bold text-white">{member.name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="truncate text-[20px] font-bold leading-tight text-white">{member.name}</p>
            <p className="mt-0.5 truncate text-sm text-[var(--flat-text-faint)]">
              {[member.role, member.defaultRateCents !== null ? `${formatCents(member.defaultRateCents)}/h usual` : null, member.active ? null : 'Inactive'].filter(Boolean).join(' · ') || 'No role or rate yet'}
            </p>
          </div>
        </div>
        {member.phone || member.email || member.company ? (
          <div className="mt-4 space-y-2.5 border-t border-[var(--flat-border)] pt-4 text-[15px]">
            {member.phone ? (
              <a href={`tel:${member.phone}`} className="flex items-center gap-2.5 text-white">
                <Phone size={16} className="shrink-0 text-white/45" /> {member.phone}
              </a>
            ) : null}
            {member.email ? (
              <a href={`mailto:${member.email}`} className="flex min-w-0 items-center gap-2.5 text-[var(--neon-cyan)]">
                <Mail size={16} className="shrink-0 text-white/45" /> <span className="truncate">{member.email}</span>
              </a>
            ) : null}
            {member.company ? (
              <p className="flex items-center gap-2.5 text-white/80">
                <Building2 size={16} className="shrink-0 text-white/45" /> {member.company}
              </p>
            ) : null}
          </div>
        ) : null}
        {member.notes ? (
          <p className="mt-4 flex gap-2.5 border-t border-[var(--flat-border)] pt-4 text-sm leading-relaxed text-white/70">
            <NotebookText size={16} className="mt-0.5 shrink-0 text-white/45" />
            <span className="whitespace-pre-line break-words">{member.notes}</span>
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-3 gap-2 rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4 text-center">
        <Stat label="Events" value={String(t.events)} sub={`${formatHours(t.minutes)} h`} />
        <Stat label="Earned" value={formatCents(t.earnedCents)} sub={`${formatCents(t.paidCents)} paid`} />
        <Stat label="Owed" value={formatCents(t.remainingCents)} tone={t.remainingCents > 0 ? 'var(--neon-orange)' : undefined} />
      </section>

      <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-bold text-white">Events worked</h2>
          {owed.length > 1 ? (
            <button
              type="button"
              onClick={() => setSelected(allTicked ? new Set() : new Set(owed.map((w) => w.lineId)))}
              className="-mr-2 rounded-full px-2 py-1.5 text-[13px] font-bold text-[var(--neon-cyan)]"
            >
              {allTicked ? 'Clear' : `Select all owed · ${owed.length}`}
            </button>
          ) : null}
        </div>
        {member.work.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--flat-text-faint)]">No labour recorded yet</p>
        ) : (
          <ul className="divide-y divide-[var(--flat-border)]">
            {member.work.map((w) => (
              <li key={w.lineId} className="flex items-center gap-1">
                {owed.length > 0 ? <PickBox owed={w.remainingCents > 0} checked={selected.has(w.lineId)} onToggle={() => toggle(w.lineId)} label={w.booking?.title ?? 'Deleted event'} /> : null}
                <Link href={`/expenses/${w.labourExpenseId}?from=${encodeURIComponent(`/finances/crew/${member.id}`)}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-white">{w.booking?.title ?? 'Deleted event'}</span>
                    <span className="mt-0.5 block truncate text-xs tabular-nums text-[var(--flat-text-faint)]">
                      {[friendlyDate(w.workedOn, today), `${formatHours(w.minutes)} h × ${formatCents(w.rateCents)}`, w.role].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-bold tabular-nums text-white">{formatCents(w.earnedCents)}</span>
                    <span className="mt-1 block">
                      <PayStatusPill state={w} />
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-white/30" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {owed.length > 0 ? (
        <>
          {/* Room so the floating button never covers the last event. */}
          <div aria-hidden className="h-14" />
          <div className="pointer-events-none fixed inset-x-0 bottom-[100px] z-40 flex justify-center px-4">
            <button
              type="button"
              onClick={() => setPaying(true)}
              aria-haspopup="dialog"
              className="pointer-events-auto flex w-full max-w-[448px] touch-manipulation select-none items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[#0a0a0a] shadow-lg shadow-black/50 transition-[transform,background-color] duration-75 active:scale-[0.97] active:bg-white/80"
            >
              <span className="text-[16px] font-bold">
                {ticked.length > 0 ? `Pay ${ticked.length} selected` : owed.length === 1 ? 'Pay what’s owed' : `Pay all ${owed.length} owed`} · {formatCents(toPayCents)}
              </span>
            </button>
          </div>
        </>
      ) : null}

      {paying ? (
        <LabourPaymentSheet
          targets={toPay.map((w) => ({ lineId: w.lineId, workerName: w.booking?.title ?? 'Deleted event', remainingCents: w.remainingCents, event: friendlyDate(w.workedOn, today) }))}
          subtitle={`${member.name} · ${formatCents(toPayCents)} owed`}
          onClose={() => setPaying(false)}
          onSaved={(amountCents, count) => {
            setPaying(false);
            setSelected(new Set());
            notifyChanged();
            showToast({ message: `Recorded ${formatCents(amountCents)} to ${member.name}${count > 1 ? ` for ${count} events` : ''}` });
          }}
        />
      ) : null}
    </div>
  );
}

// The tick on an owed event row; a paid row shows a quiet check instead.
function PickBox({ owed, checked, onToggle, label }: { owed: boolean; checked: boolean; onToggle: () => void; label: string }) {
  if (!owed) {
    return (
      <span aria-hidden className="-ml-2 flex size-11 shrink-0 items-center justify-center">
        <Check size={16} className="text-[var(--neon-green)] opacity-60" />
      </span>
    );
  }
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={`Select ${label}`} onClick={onToggle} className="-ml-2 flex size-11 shrink-0 items-center justify-center">
      <span className={`flex size-[22px] items-center justify-center rounded-full border-2 transition ${checked ? 'border-white bg-white' : 'border-white/30'}`}>
        {checked ? <Check size={14} strokeWidth={3} className="text-[#0a0a0a]" /> : null}
      </span>
    </button>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-[var(--flat-text-faint)]">{label}</p>
      <p className="mt-0.5 truncate text-[17px] font-bold tabular-nums" style={{ color: tone ?? 'white' }}>
        {value}
      </p>
      {sub ? <p className="truncate text-[11px] tabular-nums text-[var(--flat-text-faint)]">{sub}</p> : null}
    </div>
  );
}
