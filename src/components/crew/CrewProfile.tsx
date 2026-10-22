'use client';

import Link from 'next/link';
import { Building2, ChevronRight, Mail, NotebookText, Phone } from 'lucide-react';
import { PayStatusPill } from '@/components/labour/LabourDetails';
import ErrorState from '@/components/ui/ErrorState';
import type { CrewMemberDetailDto } from '@/lib/financeApi';
import { formatCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';
import { formatHours } from '@/lib/finance/labour';

// A crew person's profile: who they are and how to reach them, their usual
// rate, the events they've worked and whether they're still owed money.
// Every event row shows the rate actually used there, which may differ from
// today's default.
export default function CrewProfile({ member, error }: { member: CrewMemberDetailDto | undefined; error: string | null }) {
  const today = todayLocal();
  if (error && !member) return <ErrorState message={error} />;
  if (!member) return <div className="h-40 animate-pulse rounded-3xl bg-white/[0.03]" aria-busy="true" />;
  const t = member.totals;

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
        <h2 className="mb-1 text-[17px] font-bold text-white">Events worked</h2>
        {member.work.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--flat-text-faint)]">No labour recorded yet</p>
        ) : (
          <ul className="divide-y divide-[var(--flat-border)]">
            {member.work.map((w) => (
              <li key={w.lineId}>
                <Link href={`/expenses/${w.labourExpenseId}?from=${encodeURIComponent(`/finances/crew/${member.id}`)}`} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-white">{w.booking?.title ?? 'Deleted event'}</span>
                    <span className="mt-0.5 block truncate text-xs tabular-nums text-[var(--flat-text-faint)]">
                      {[friendlyDate(w.workedOn, today), `${formatHours(w.minutes)} h × ${formatCents(w.rateCents)}`, w.role].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-bold tabular-nums text-white">{formatCents(w.earnedCents)}</span>
                    <span className="mt-1 block">
                      <PayStatusPill status={w.status} />
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-white/30" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
