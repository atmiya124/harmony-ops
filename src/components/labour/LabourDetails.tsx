'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus, Users } from 'lucide-react';
import LabourPaymentSheet from './LabourPaymentSheet';
import PaidButton from './PaidButton';
import { useQuickPay } from './useQuickPay';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import { partnerLabel } from '@/components/expenses/partnerLabel';
import ErrorState from '@/components/ui/ErrorState';
import { colorAlpha } from '@/lib/colorAlpha';
import { useCachedData } from '@/hooks/useCachedData';
import { FINANCE_PARTNERS_KEY, getLabour, getPartners, labourKey, type ExpenseDetailDto, type LabourLineDto } from '@/lib/financeApi';
import { formatCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';
import { formatHours, LABOUR_PAY_STATUS_LABELS, labourSummaryLabel, paidPercent, type LabourPayState, type LabourPayStatus } from '@/lib/finance/labour';
import { PAYMENT_METHOD_LABELS } from '@/lib/finance/types';

// An event's crew labour: each person's hours and rate, what they earned,
// what they've been paid and what's still owed — Paid (in full, one tap) or
// Record payment for another amount. This
// is where crew detail belongs; Finance lists only show the total.

export const PAY_STATUS_COLOR: Record<LabourPayStatus, string> = {
  unpaid: 'var(--neon-orange)',
  partial: 'var(--neon-orange)',
  paid: 'var(--neon-green)',
};

// "Unpaid", "40% paid" or "Paid".
export function PayStatusPill({ state }: { state: Pick<LabourPayState, 'status' | 'earnedCents' | 'paidCents'> }) {
  const color = PAY_STATUS_COLOR[state.status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums" style={{ backgroundColor: colorAlpha(color, 14), color }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {state.status === 'partial' ? `${paidPercent(state)}% paid` : LABOUR_PAY_STATUS_LABELS[state.status]}
    </span>
  );
}

export default function LabourDetails({ expense }: { expense: ExpenseDetailDto }) {
  const { version, notifyChanged, showToast } = useExpenseEntry();
  const { data: labour, error } = useCachedData(labourKey(expense.id), () => getLabour(expense.id), version);
  const partners = useCachedData(FINANCE_PARTNERS_KEY, getPartners).data?.partners ?? [];
  const [paying, setPaying] = useState<LabourLineDto | null>(null);
  const { pay, unpay, busyKey } = useQuickPay();
  const today = todayLocal();
  const nameFor = (email: string) => partnerLabel(partners.find((p) => p.email === email) ?? { email, name: null });

  if (error && !labour) return <ErrorState message={error} />;
  if (!labour) return <div className="h-40 animate-pulse rounded-3xl bg-white/[0.03]" aria-busy="true" />;
  const t = labour.totals;

  return (
    <div className="space-y-4 pb-2">
      {labour.deletedAt ? (
        <p className="rounded-2xl border border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.08)] px-4 py-3 text-sm text-[var(--neon-pink)]">This labour was deleted.</p>
      ) : null}

      <section className="flex items-center gap-4 px-1 pb-2 pt-1">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colorAlpha('var(--neon-purple)', 18) }}>
          <Users size={28} style={{ color: 'var(--neon-purple)' }} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[22px] font-semibold leading-tight text-white">Crew labour</h2>
          <p className="mt-1 text-[34px] font-bold leading-none tracking-tight tabular-nums text-white">{formatCents(t.earnedCents)}</p>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/[0.08] bg-[#0a0f16]/80 p-5">
        {labour.booking ? (
          <Link href={`/events/bookings/${labour.booking.id}`} className="flex items-center justify-between gap-3 text-white">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{labour.booking.title}</span>
              <span className="block text-[13px] text-white/45">
                {friendlyDate(labour.booking.eventDate, today)} · {labourSummaryLabel(t)}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-white/35" />
          </Link>
        ) : (
          <p className="text-[15px] text-white/45">{labourSummaryLabel(t)}</p>
        )}
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-4 text-center">
          <Figure label="Earned" cents={t.earnedCents} />
          <Figure label="Paid" cents={t.paidCents} />
          <Figure label="Owed" cents={t.remainingCents} tone={t.remainingCents > 0 ? 'var(--neon-orange)' : undefined} />
        </dl>
      </section>

      <ul className="space-y-3">
        {labour.lines.map((l) => (
          <li key={l.id} className="rounded-[24px] border border-white/[0.08] bg-[#0a0f16]/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {l.crewMemberId ? (
                  <Link href={`/finances/crew/${l.crewMemberId}`} className="inline-flex max-w-full items-center gap-1 text-[16px] font-semibold text-white">
                    <span className="truncate">{l.workerName}</span>
                    <ChevronRight size={15} className="shrink-0 text-white/35" />
                  </Link>
                ) : (
                  <p className="truncate text-[16px] font-semibold text-white">{l.workerName}</p>
                )}
                <p className="mt-0.5 text-[13px] tabular-nums text-white/45">
                  {[l.role, `${formatHours(l.minutes)} h × ${formatCents(l.rateCents)}/h`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[16px] font-bold tabular-nums text-white">{formatCents(l.earnedCents)}</p>
                <div className="mt-1">
                  <PayStatusPill state={l} />
                </div>
              </div>
            </div>

            {l.payments.length > 0 ? (
              <ul className="mt-3 divide-y divide-white/[0.06] border-t border-white/[0.07]">
                {l.payments.map((p) => (
                  <li key={p.id}>
                    <Link href={`/expenses/${p.id}`} className="flex items-center gap-2 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-white/60">
                        {[friendlyDate(p.paidOn, today), PAYMENT_METHOD_LABELS[p.paymentMethod], nameFor(p.paidByEmail), p.reference].filter(Boolean).join(' · ')}
                      </span>
                      <span className="shrink-0 text-[14px] font-semibold tabular-nums text-white/85">{formatCents(p.amountCents)}</span>
                      <ChevronRight size={14} className="shrink-0 text-white/25" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {l.earnedCents > 0 && !labour.deletedAt ? (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                {l.remainingCents > 0 ? (
                  <span className="text-[13px] text-white/45">
                    <span className="font-semibold tabular-nums text-[var(--neon-orange)]">{formatCents(l.remainingCents)}</span> owed
                  </span>
                ) : (
                  <span className="text-[13px] text-white/45">Fully paid</span>
                )}
                <div className="flex items-center gap-2">
                  {l.remainingCents > 0 ? (
                    <button type="button" onClick={() => setPaying(l)} className="flex items-center gap-1 rounded-full px-2 py-2 text-white/70">
                      <Plus size={14} /> <span className="text-[13px] font-semibold">Other amount</span>
                    </button>
                  ) : null}
                  <PaidButton
                    paid={l.status === 'paid'}
                    busy={busyKey === l.id}
                    disabled={busyKey !== null}
                    onPay={() => pay(l.id, l.workerName, [{ lineId: l.id, remainingCents: l.remainingCents }])}
                    // Undo removes this person's payments for the event.
                    onUnpay={() => unpay(l.id, l.workerName, async () => l.payments.map((p) => p.id))}
                    name={l.workerName}
                  />
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {paying ? (
        <LabourPaymentSheet
          line={paying}
          onClose={() => setPaying(null)}
          onSaved={(_labour, amountCents) => {
            setPaying(null);
            notifyChanged();
            showToast({ message: `Recorded ${formatCents(amountCents)} to ${paying.workerName}` });
          }}
        />
      ) : null}
    </div>
  );
}

function Figure({ label, cents, tone }: { label: string; cents: number; tone?: string }) {
  return (
    <div>
      <dt className="text-[12px] text-white/45">{label}</dt>
      <dd className="mt-0.5 text-[16px] font-bold tabular-nums" style={{ color: tone ?? 'white' }}>
        {formatCents(cents)}
      </dd>
    </div>
  );
}
