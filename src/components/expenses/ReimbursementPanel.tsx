'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { addReimbursement, ApiError, voidReimbursement, type ExpenseDetailDto } from '@/lib/financeApi';
import DateChip from '@/components/ui/DateChip';
import { centsToInput, formatCents, parseAmountToCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';
import { REIMBURSEMENT_METHOD_LABELS, REIMBURSEMENT_METHODS, REIMBURSEMENT_STATUS_LABELS, type ReimbursementMethod } from '@/lib/finance/types';

// Paying a partner back, in full or in parts, inside the edit sheet. Each
// payment is its own record; mistakes are voided with a reason and stay in
// the history. The expense's own amount and totals never change.
export default function ReimbursementPanel({
  expense,
  paidByLabel,
  nameFor,
  onUpdated,
}: {
  expense: ExpenseDetailDto;
  paidByLabel: string;
  // Partner display name for an email (who recorded / voided a payment).
  nameFor: (email: string) => string;
  onUpdated: (next: ExpenseDetailDto) => void;
}) {
  const today = todayLocal();
  const { status, reimbursedCents, outstandingCents } = expense.reimbursement;
  const [recording, setRecording] = useState(false);
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [amountText, setAmountText] = useState('');
  const [reimbursedOn, setReimbursedOn] = useState(today);
  const [method, setMethod] = useState<ReimbursementMethod>('etransfer');
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidPct = expense.amountCents > 0 ? Math.min(100, Math.round((reimbursedCents / expense.amountCents) * 100)) : 0;

  function startRecording() {
    setPaymentId(crypto.randomUUID());
    setAmountText(centsToInput(outstandingCents));
    setReimbursedOn(today);
    setError(null);
    setRecording(true);
  }

  async function savePayment() {
    const parsed = parseAmountToCents(amountText);
    if (!parsed.ok) return setError(parsed.error);
    if (parsed.cents > outstandingCents) return setError(`Only ${formatCents(outstandingCents)} is outstanding`);
    setBusy(true);
    setError(null);
    try {
      onUpdated(await addReimbursement(expense.id, paymentId, { amountCents: parsed.cents, reimbursedOn, method, notes: null }));
      setRecording(false);
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fieldErrors)[0]?.[0] ?? err.message) : 'Could not record the payment');
    } finally {
      setBusy(false);
    }
  }

  async function confirmVoid(id: string) {
    if (voidReason.trim().length < 3) return setError('Give a short reason for voiding');
    setBusy(true);
    setError(null);
    try {
      onUpdated(await voidReimbursement(expense.id, id, voidReason.trim()));
      setVoidingId(null);
      setVoidReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not void the payment');
    } finally {
      setBusy(false);
    }
  }

  if (!expense.reimbursable && expense.reimbursements.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--flat-border)] bg-white/[0.03] p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Reimbursement</p>
        <span className="text-[11px] font-bold text-[var(--flat-text-dim)]">{REIMBURSEMENT_STATUS_LABELS[status]}</span>
      </div>

      {expense.reimbursable ? (
        <>
          <p className="mt-2 text-sm text-white">
            <span className="font-bold">{formatCents(reimbursedCents)}</span>
            <span className="text-[var(--flat-text-faint)]"> of {formatCents(expense.amountCents)} paid back to {paidByLabel}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[var(--neon-purple)] transition-all duration-500" style={{ width: `${paidPct}%` }} />
          </div>
          {outstandingCents > 0 ? (
            <p className="mt-1.5 text-xs text-[var(--flat-text-dim)]">
              <span className="font-bold text-white">{formatCents(outstandingCents)}</span> outstanding
            </p>
          ) : null}
        </>
      ) : null}

      {expense.reimbursements.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {expense.reimbursements.map((r) => (
            <li key={r.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs ${r.voidedAt ? 'text-[var(--flat-text-faint)] line-through' : 'text-[var(--flat-text-dim)]'}`}>
                  {friendlyDate(r.reimbursedOn, today)} · {REIMBURSEMENT_METHOD_LABELS[r.method]} · {nameFor(r.recordedByEmail)}
                </span>
                <span className={`text-sm font-bold tabular-nums ${r.voidedAt ? 'text-[var(--flat-text-faint)] line-through' : 'text-white'}`}>{formatCents(r.amountCents)}</span>
              </div>
              {r.voidedAt ? (
                <p className="mt-0.5 text-[11px] text-[var(--flat-text-faint)]">
                  Voided by {r.voidedByEmail ? nameFor(r.voidedByEmail) : 'a partner'}: {r.voidReason}
                </p>
              ) : voidingId === r.id ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="Why? e.g. entered twice"
                    maxLength={500}
                    aria-label="Reason for voiding"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--flat-border)] bg-white/[0.04] px-2.5 py-1.5 text-white outline-none placeholder:text-[var(--flat-text-faint)]"
                    style={{ fontSize: 16 }}
                  />
                  <button type="button" disabled={busy} onClick={() => confirmVoid(r.id)} className="rounded-lg bg-[var(--neon-pink)] px-3 text-[#0a0a0a] disabled:opacity-50">
                    <span className="text-xs font-bold">Void</span>
                  </button>
                  <button type="button" onClick={() => setVoidingId(null)} className="px-1 text-[var(--flat-text-faint)]">
                    <span className="text-xs font-bold">Cancel</span>
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => {
                    setVoidingId(r.id);
                    setVoidReason('');
                    setError(null);
                  }} className="mt-0.5 text-[var(--flat-text-faint)]">
                  <span className="text-[11px] font-bold">Void…</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {recording ? (
        <div className="mt-3 space-y-2.5 rounded-xl bg-white/[0.04] p-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1 rounded-xl border border-[var(--flat-border)] bg-white/[0.04] px-3 py-2">
              <span className="text-white/50">$</span>
              <input
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ''))}
                inputMode="decimal"
                aria-label="Amount paid back"
                className="w-full min-w-0 bg-transparent font-bold text-white outline-none"
                style={{ fontSize: 18 }}
              />
            </div>
            <DateChip
              value={reimbursedOn}
              label={friendlyDate(reimbursedOn, today)}
              min={expense.expenseDate}
              max={today}
              onChange={setReimbursedOn}
              ariaLabel="Date paid back"
              className="gap-1.5 rounded-xl border border-[var(--flat-border)] bg-white/[0.04] px-3 py-2.5"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REIMBURSEMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
                className={`rounded-full border px-3 py-1.5 ${method === m ? 'border-white/40 bg-white/[0.1] text-white' : 'border-[var(--flat-border)] text-[var(--flat-text-dim)]'}`}
              >
                <span className="text-[11px] font-bold">{REIMBURSEMENT_METHOD_LABELS[m]}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRecording(false)} className="flex-1 rounded-full border border-[var(--flat-border)] py-2.5 text-[var(--flat-text-dim)]">
              <span className="text-xs font-bold">Cancel</span>
            </button>
            <button type="button" disabled={busy} onClick={savePayment} className="flex flex-[2] items-center justify-center gap-1.5 rounded-full bg-[var(--neon-purple)] py-2.5 text-[#0a0a0a] disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              <span className="text-xs font-bold">Record payment</span>
            </button>
          </div>
        </div>
      ) : expense.reimbursable && outstandingCents > 0 ? (
        <button
          type="button"
          onClick={startRecording}
          className="mt-3 w-full rounded-full border border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.1)] py-2.5 text-[var(--neon-purple)]"
        >
          <span className="text-xs font-bold">Record reimbursement</span>
        </button>
      ) : null}

      {error ? <p className="mt-2 text-xs text-[var(--neon-pink)]">{error}</p> : null}
    </div>
  );
}
