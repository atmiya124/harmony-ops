'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Wallet, X } from 'lucide-react';
import SpendingCard from './SpendingCard';
import ExpenseList from '@/components/expenses/ExpenseList';
import { CATEGORY_META } from '@/components/expenses/categoryMeta';
import { partnerLabel } from '@/components/expenses/partnerLabel';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import DateChip from '@/components/ui/DateChip';
import ErrorState from '@/components/ui/ErrorState';
import { useCachedData } from '@/hooks/useCachedData';
import { ApiError, expensesKey, getPartnerSummary, listExpenses, partnerKey, recordPartnerPayment, type ExpenseDto, type PartnerSummaryDto } from '@/lib/financeApi';
import { centsToInput, formatCents, parseAmountToCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';
import { REIMBURSEMENT_METHOD_LABELS, REIMBURSEMENT_METHODS, type ReimbursementMethod } from '@/lib/finance/types';

// One partner: what they're owed, what they've spent and been paid back,
// where it went, every payment back to them, and every expense they paid.
export default function PartnerDetail({ email }: { email: string }) {
  const { version } = useExpenseEntry();
  const { data: summary, error } = useCachedData(partnerKey(email), () => getPartnerSummary(email), version);
  // Their expenses (also what the list below shows), for the payment preview.
  // The partner's own money: crew payments they made, never labour they only entered.
  const filter = { paidBy: email, limit: 500, view: 'outlay' as const };
  const { data: expenses } = useCachedData(expensesKey(filter), () => listExpenses(filter), version);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<string | null>(null);

  if (error && !summary) return <ErrorState message={error} />;
  if (!summary) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-40 animate-pulse rounded-3xl bg-white/[0.03]" />
        <div className="h-24 animate-pulse rounded-3xl bg-white/[0.03]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
        <p className="text-xs text-[var(--flat-text-faint)]">Owed back to {partnerLabel(summary.partner)}</p>
        {/* Orange while money is still owed back; white once settled. */}
        <p className={`mt-1 text-[40px] font-bold leading-none tabular-nums ${summary.owedCents > 0 ? 'text-[var(--neon-orange)]' : 'text-white'}`}>{formatCents(summary.owedCents)}</p>
        <p className="mt-2 text-xs text-[var(--flat-text-faint)]">{formatCents(summary.reimbursedCents)} paid back so far</p>
        {paid ? (
          <p role="status" className="mt-3 flex items-center gap-1.5 text-sm font-bold text-[var(--neon-green)]">
            <Check size={16} /> {paid}
          </p>
        ) : null}
        {summary.owedCents > 0 ? (
          <button
            type="button"
            onClick={() => {
              setPaid(null);
              setPaying(true);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[15px] font-bold text-[#0a0a0a] transition active:scale-[0.97]"
          >
            <Wallet size={18} /> Record payment
          </button>
        ) : (
          <p className="mt-3 text-sm text-[var(--flat-text-dim)]">All paid up — nothing is owed.</p>
        )}
      </section>

      <SpendingCard personalCents={summary.personalCents} businessCents={summary.companyCents} byCategory={summary.byCategory} />

      <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
        <h2 className="mb-1 text-lg font-bold text-white">Payments back</h2>
        <PaymentHistory summary={summary} />
      </section>

      <section className="rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
        <h2 className="mb-1 flex items-baseline justify-between text-lg font-bold text-white">
          Expenses paid <span className="text-xs font-normal text-[var(--flat-text-faint)]">{summary.expenseCount}</span>
        </h2>
        <ExpenseList filter={{ paidBy: email, view: 'outlay' }} limit={500} emptyText={`${partnerLabel(summary.partner)} hasn't paid for anything yet`} />
      </section>

      {paying ? (
        <RecordPaymentSheet
          summary={summary}
          expenses={expenses ?? []}
          onClose={() => setPaying(false)}
          onRecorded={(amount) => {
            setPaying(false);
            setPaid(`${formatCents(amount)} payment recorded`);
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentHistory({ summary }: { summary: PartnerSummaryDto }) {
  const today = todayLocal();
  if (summary.payments.length === 0) return <p className="py-4 text-center text-xs text-[var(--flat-text-faint)]">No payments back yet</p>;
  return (
    <ul className="divide-y divide-[var(--flat-border)]">
      {summary.payments.map((p) => (
        <li key={p.key} className={`py-3 ${p.voided ? 'opacity-50' : ''}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-white">
                {REIMBURSEMENT_METHOD_LABELS[p.method]}
                {p.voided ? <span className="ml-2 text-xs font-bold text-[var(--neon-pink)]">Voided</span> : null}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--flat-text-faint)]">
                {friendlyDate(p.reimbursedOn, today)} · covers {p.parts.length === 1 ? CATEGORY_META[p.parts[0].category].label.toLowerCase() : `${p.parts.length} expenses`}
                {p.notes ? ` · ${p.notes}` : ''}
              </span>
              {p.voided && p.voidReason ? <span className="mt-0.5 block text-xs text-[var(--flat-text-faint)]">Reason: {p.voidReason}</span> : null}
            </span>
            <span className={`shrink-0 text-[15px] font-bold tabular-nums text-white ${p.voided ? 'line-through' : ''}`}>{formatCents(p.amountCents)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Which outstanding expenses a payment would cover, oldest first — the same
// order and date rule the server applies.
function allocate(expenses: ExpenseDto[], amountCents: number, date: string) {
  const owing = expenses
    .filter((e) => e.reimbursement.outstandingCents > 0 && e.expenseDate <= date)
    .sort((a, b) => (a.expenseDate + a.createdAt).localeCompare(b.expenseDate + b.createdAt));
  const parts: { expense: ExpenseDto; cents: number }[] = [];
  let left = amountCents;
  for (const e of owing) {
    if (left <= 0) break;
    const cents = Math.min(left, e.reimbursement.outstandingCents);
    parts.push({ expense: e, cents });
    left -= cents;
  }
  return { parts, eligibleCents: owing.reduce((s, e) => s + e.reimbursement.outstandingCents, 0) };
}

function RecordPaymentSheet({
  summary,
  expenses,
  onClose,
  onRecorded,
}: {
  summary: PartnerSummaryDto;
  expenses: ExpenseDto[];
  onClose: () => void;
  onRecorded: (amountCents: number) => void;
}) {
  const today = todayLocal();
  const [paymentId] = useState(() => crypto.randomUUID());
  const [amountText, setAmountText] = useState(() => centsToInput(summary.owedCents));
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<ReimbursementMethod>('etransfer');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = partnerLabel(summary.partner);

  const parsed = parseAmountToCents(amountText);
  const preview = useMemo(() => allocate(expenses, parsed.ok ? parsed.cents : 0, date), [expenses, parsed, date]);

  async function save() {
    if (!parsed.ok) return setError(parsed.error);
    if (parsed.cents > summary.owedCents) return setError(`Only ${formatCents(summary.owedCents)} is owed`);
    if (parsed.cents > preview.eligibleCents) return setError(`Only ${formatCents(preview.eligibleCents)} is owed for expenses up to this date`);
    setBusy(true);
    setError(null);
    try {
      await recordPartnerPayment(summary.partner.email, paymentId, { amountCents: parsed.cents, reimbursedOn: date, method, notes: notes.trim() || null });
      onRecorded(parsed.cents);
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fieldErrors)[0]?.[0] ?? err.message) : 'Could not record the payment');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="record-payment-title">
      <div className="max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1118] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 id="record-payment-title" className="text-lg font-bold text-white">
            Pay back {name}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-white/[0.06] text-white">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--flat-text-faint)]">{formatCents(summary.owedCents)} owed. Applied to the oldest expenses first.</p>

        <label className="mt-4 block">
          <span className="text-xs text-[var(--flat-text-faint)]">Amount</span>
          <span className="mt-1 flex items-center rounded-2xl border border-[var(--flat-border)] bg-[var(--flat-surface-input)] px-4">
            <span className="text-lg text-[var(--flat-text-dim)]">$</span>
            <input
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="w-full bg-transparent px-2 py-3 text-lg font-bold tabular-nums text-white outline-none"
              aria-label="Amount paid back"
            />
          </span>
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DateChip value={date} label={friendlyDate(date, today)} onChange={setDate} max={today} ariaLabel="Date paid" />
          {REIMBURSEMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${method === m ? 'bg-white text-[#0a0a0a]' : 'bg-white/[0.06] text-[var(--flat-text-dim)]'}`}
            >
              {REIMBURSEMENT_METHOD_LABELS[m]}
            </button>
          ))}
        </div>

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder="Note (optional), e.g. e-transfer reference"
          className="mt-3 w-full rounded-2xl border border-[var(--flat-border)] bg-[var(--flat-surface-input)] px-4 py-3 text-white outline-none placeholder:text-[var(--flat-text-faint)]"
        />

        {preview.parts.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-white/[0.03] px-3 py-2">
            <p className="py-1 text-xs text-[var(--flat-text-faint)]">This payment covers</p>
            <ul className="divide-y divide-[var(--flat-border)]">
              {preview.parts.map(({ expense, cents }) => (
                <li key={expense.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-white">
                    {CATEGORY_META[expense.category].label}
                    <span className="text-[var(--flat-text-faint)]"> · {friendlyDate(expense.expenseDate, today)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-white">
                    {formatCents(cents)}
                    {cents < expense.reimbursement.outstandingCents ? <span className="text-[var(--flat-text-faint)]"> of {formatCents(expense.reimbursement.outstandingCents)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-[var(--neon-pink)]">{error}</p> : null}

        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-[15px] font-bold text-[#0a0a0a] transition active:scale-[0.97] disabled:opacity-40"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : null}
          {busy ? 'Saving…' : parsed.ok ? `Record ${formatCents(parsed.cents)} payment` : 'Record payment'}
        </button>
      </div>
    </div>
  );
}
