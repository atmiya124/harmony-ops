'use client';

import { useState } from 'react';
import { ArrowLeftRight, Banknote, CheckCircle2, CreditCard, Landmark, Mail, MailCheck, PiggyBank, Undo2, Wallet, type LucideIcon } from 'lucide-react';
import { ApiError } from '@/lib/apiClient';
import { partnerLabel } from '@/components/expenses/partnerLabel';
import { useCachedData } from '@/hooks/useCachedData';
import { FINANCE_PARTNERS_KEY, getPartners } from '@/lib/financeApi';
import { recordPayment, sendReceipt, undoPayment, type InvoiceDto, type InvoicePaymentDto, type ReceiptOutcome } from '@/lib/quotesApi';
import { centsToInput, formatCents, parseAmountToCents } from '@/lib/money';
import { activityDateTime, torontoDate } from '@/lib/sales/format';
import { paymentBlocker } from '@/lib/sales/invoicePayments';
import { INVOICE_PAYMENT_KIND_LABELS, INVOICE_PAYMENT_METHOD_LABELS, type InvoicePaymentMethod } from '@/lib/sales/types';
import { buttonClass, Card, DateInput, Dialog, documentDate, Eyebrow, Field, inputClass, Notice, PaymentMethodSelect } from './ui';

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError || err instanceof Error ? err.message : fallback);
const today = () => torontoDate(new Date().toISOString());

// ---------------------------------------------------------------- list

// Every payment on the invoice, newest first. An undone one stays in the
// list, struck through, so the history is never lost.
export function PaymentsCard({ invoice, onChange }: { invoice: InvoiceDto; onChange: (inv: InvoiceDto) => void }) {
  const [undoing, setUndoing] = useState<InvoicePaymentDto | null>(null);
  const partners = useCachedData(FINANCE_PARTNERS_KEY, getPartners).data?.partners ?? [];
  const nameFor = (email: string) => partnerLabel(partners.find((p) => p.email === email) ?? { email, name: null });
  const count = invoice.payments.filter((p) => !p.voidedAt).length;
  return (
    <Card>
      <Eyebrow
        aside={
          invoice.payments.length ? (
            <>
              {count} payment{count === 1 ? '' : 's'} · <span className="font-semibold text-[var(--ink)]">{formatCents(invoice.depositPaidCents + invoice.amountPaidCents)}</span> received
            </>
          ) : null
        }
      >
        Payments
      </Eyebrow>
      {invoice.payments.length === 0 ? (
        <p className="text-[14px] text-[var(--ink-3)]">No payments yet.</p>
      ) : (
        <ul className="-mx-2 space-y-1">
          {invoice.payments.map((p) => (
            <PaymentRow key={p.id} invoice={invoice} payment={p} recordedBy={nameFor(p.recordedByEmail)} onChange={onChange} onUndo={() => setUndoing(p)} />
          ))}
        </ul>
      )}
      <UndoPaymentDialog invoice={invoice} payment={undoing} onClose={() => setUndoing(null)} onChange={onChange} />
    </Card>
  );
}

const METHOD_ICONS: Record<InvoicePaymentMethod, LucideIcon> = { etransfer: ArrowLeftRight, card: CreditCard, bank_transfer: Landmark, cash: Banknote };

function PaymentRow({ invoice, payment: p, recordedBy, onChange, onUndo }: { invoice: InvoiceDto; payment: InvoicePaymentDto; recordedBy: string; onChange: (inv: InvoiceDto) => void; onUndo: () => void }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendId, setSendId] = useState(() => crypto.randomUUID());
  const voided = !!p.voidedAt;
  const Icon = p.method ? METHOD_ICONS[p.method] : p.kind === 'deposit' ? PiggyBank : Wallet;
  const meta = [documentDate(p.receivedOn), p.reference, `by ${recordedBy}`].filter(Boolean).join(' · ');

  async function send() {
    setSending(true);
    setError(null);
    try {
      onChange(await sendReceipt(invoice.id, p.id, sendId));
      setSendId(crypto.randomUUID()); // a later send is a new email
    } catch (err) {
      setError(errorText(err, 'The receipt couldn’t be sent'));
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="rounded-2xl px-2 py-2.5 transition hover:bg-[var(--tray)]">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${voided ? 'bg-[var(--line)] text-[var(--ink-3)]' : 'bg-[var(--ok-soft)] text-[var(--ok)]'}`} aria-hidden>
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-2 text-[15px] font-semibold ${voided ? 'text-[var(--ink-3)] line-through' : ''}`}>
            {INVOICE_PAYMENT_KIND_LABELS[p.kind]}
            {p.method ? (
              <span className="rounded-full border border-[var(--line)] px-2 py-px text-[11px] font-medium text-[var(--ink-2)] no-underline">{INVOICE_PAYMENT_METHOD_LABELS[p.method]}</span>
            ) : null}
          </p>
          <p className="truncate text-[12px] text-[var(--ink-3)]" title={`Recorded by ${p.recordedByEmail}`}>
            {meta}
          </p>
        </div>
        <span className={`shrink-0 text-[16px] font-bold tabular-nums ${voided ? 'text-[var(--ink-3)] line-through' : ''}`}>{formatCents(p.amountCents)}</span>
      </div>

      {/* Actions, under the text so they line up with it. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-[52px] text-[12px]">
        {voided ? (
          <span className="text-[var(--bad)]">
            Undone {activityDateTime(p.voidedAt!)}
            {p.voidReason ? ` · ${p.voidReason}` : ''}
          </span>
        ) : (
          <>
            {p.receiptSentAt ? (
              <span className="flex items-center gap-1 text-[var(--ok)]">
                <MailCheck size={13} aria-hidden /> Receipt sent {activityDateTime(p.receiptSentAt)}
              </span>
            ) : null}
            {invoice.customerEmail ? (
              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold text-[var(--accent-ink)] transition hover:brightness-95 disabled:opacity-50"
              >
                <Mail size={13} aria-hidden /> {sending ? 'Sending…' : p.receiptSentAt ? 'Send again' : 'Send receipt'}
              </button>
            ) : null}
            <button type="button" onClick={onUndo} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[var(--ink-3)] transition hover:bg-[var(--line)] hover:text-[var(--ink-2)]">
              <Undo2 size={12} aria-hidden /> Undo
            </button>
          </>
        )}
      </div>
      {error ? (
        <div className="mt-2 pl-[52px]">
          <Notice>{error}</Notice>
        </div>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------- record

// The button that opens the Record payment dialog; hidden when the invoice
// can't take payments. `compact`: a small pill, beside the paid bar.
export function RecordPaymentButton({ invoice, onChange, compact = false }: { invoice: InvoiceDto; onChange: (inv: InvoiceDto) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  // A new dialog each time it opens, so the form starts fresh.
  const [session, setSession] = useState(0);
  const blocker = paymentBlocker(invoice);
  return (
    <>
      {blocker ? null : (
        <button
          type="button"
          onClick={() => {
            setSession((s) => s + 1);
            setOpen(true);
          }}
          className={buttonClass('primary', compact ? 'px-4 py-2 text-[14px]' : 'w-full py-3.5 text-[16px]')}
        >
          <Wallet size={compact ? 15 : 16} /> Record payment
        </button>
      )}
      {/* Stays mounted once the invoice is paid, to show the result. */}
      <RecordPaymentDialog key={session} invoice={invoice} open={open} onClose={() => setOpen(false)} onChange={onChange} />
    </>
  );
}

function RecordPaymentDialog({ invoice, open, onClose, onChange }: { invoice: InvoiceDto; open: boolean; onClose: () => void; onChange: (inv: InvoiceDto) => void }) {
  const [paymentId] = useState(() => crypto.randomUUID());
  const [amountInput, setAmountInput] = useState(() => centsToInput(invoice.balanceDueCents));
  const [method, setMethod] = useState<InvoicePaymentMethod>('etransfer');
  const [receivedOn, setReceivedOn] = useState(today);
  const [reference, setReference] = useState('');
  // Never on by default: a receipt goes only when staff ask for one.
  const [emailReceipt, setEmailReceipt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ amountCents: number; balanceDueCents: number; receipt: ReceiptOutcome } | null>(null);

  const amount = parseAmountToCents(amountInput, invoice.balanceDueCents);
  const dateError = !receivedOn ? 'Choose the date' : receivedOn > today() ? 'Can’t be after today' : null;
  const balanceAfter = invoice.balanceDueCents - (amount.ok ? amount.cents : 0);

  function close() {
    if (busy) return;
    onClose();
  }

  async function save() {
    if (!amount.ok) return;
    setBusy(true);
    setError(null);
    try {
      const result = await recordPayment(
        invoice.id,
        { paymentId, amountCents: amount.cents, method, receivedOn, reference: reference.trim() || null, sendReceipt: emailReceipt && !!invoice.customerEmail },
        invoice.updatedAt,
      );
      setDone({ amountCents: amount.cents, balanceDueCents: result.invoice.balanceDueCents, receipt: result.receipt });
      onChange(result.invoice);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.current) onChange(err.current as InvoiceDto);
      setError(errorText(err, 'The payment couldn’t be saved'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} locked={busy} labelledBy="record-payment-title">
      <div className="rounded-[22px] bg-[var(--paper)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center" role="status">
            <CheckCircle2 size={36} className="text-[var(--ok)]" aria-hidden />
            <h2 id="record-payment-title" className="text-[19px] font-bold">
              {formatCents(done.amountCents)} recorded
            </h2>
            <p className="text-[14px] text-[var(--ink-2)]">{done.balanceDueCents > 0 ? `${formatCents(done.balanceDueCents)} is still due on ${invoice.invoiceNumber}.` : `${invoice.invoiceNumber} is now paid in full.`}</p>
            {done.receipt?.sent ? (
              <p className="flex items-center gap-1.5 text-[13px] text-[var(--ok)]">
                <MailCheck size={14} aria-hidden /> Receipt emailed to {done.receipt.to}
              </p>
            ) : null}
            {done.receipt && !done.receipt.sent ? (
              <div className="mt-2 w-full text-left">
                <Notice>The payment is saved, but the receipt wasn’t sent: {done.receipt.error} You can send it from the Payments list.</Notice>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <h2 id="record-payment-title" className="text-[19px] font-bold">
              Record payment
            </h2>
            <p className="mt-1 text-[14px] text-[var(--ink-2)]">
              {invoice.invoiceNumber} · {formatCents(invoice.balanceDueCents)} due
            </p>

            <div className="mt-4 space-y-3">
              <Field label="Amount received" error={amount.ok ? undefined : amount.error}>
                <input inputMode="decimal" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} aria-invalid={!amount.ok || undefined} className={inputClass} autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Paid by">
                  <PaymentMethodSelect value={method} onChange={setMethod} />
                </Field>
                <Field label="Received on" error={dateError ?? undefined}>
                  <DateInput value={receivedOn} onChange={setReceivedOn} max={today()} invalid={!!dateError} />
                </Field>
              </div>
              <Field label="Reference or note (optional)">
                <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} placeholder="e.g. e-transfer reference" className={inputClass} />
              </Field>
              <label className={`flex items-start gap-2.5 text-[14px] ${invoice.customerEmail ? '' : 'opacity-50'}`}>
                <input type="checkbox" checked={emailReceipt} disabled={!invoice.customerEmail} onChange={(e) => setEmailReceipt(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ink)]" />
                <span>
                  Email a receipt to the client
                  <span className="block text-[12px] text-[var(--ink-3)]">{invoice.customerEmail ? `To ${invoice.customerEmail}, with the updated invoice attached` : 'This invoice has no client email'}</span>
                </span>
              </label>
            </div>

            <dl className="mt-4 flex items-baseline justify-between border-t border-[var(--line)] pt-3 text-[14px]">
              <dt className="font-semibold">Balance after</dt>
              <dd className="text-[18px] font-bold tabular-nums">{balanceAfter > 0 ? formatCents(balanceAfter) : 'Paid in full'}</dd>
            </dl>
            {error ? (
              <div className="mt-3">
                <Notice>{error}</Notice>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-1 px-1 pt-3">
        {done ? (
          <button type="button" onClick={close} className={buttonClass('primary', 'w-full py-3.5 text-[16px]')}>
            Done
          </button>
        ) : (
          <>
            <button type="button" onClick={save} disabled={busy || !amount.ok || !!dateError} className={buttonClass('primary', 'w-full py-3.5 text-[16px]')}>
              <Wallet size={17} /> {busy ? 'Saving…' : emailReceipt && invoice.customerEmail ? 'Save and email receipt' : 'Save payment'}
            </button>
            <button type="button" onClick={close} disabled={busy} className={buttonClass('ghost', 'w-full py-3 text-[15px]')}>
              Cancel
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- undo

function UndoPaymentDialog({ invoice, payment, onClose, onChange }: { invoice: InvoiceDto; payment: InvoicePaymentDto | null; onClose: () => void; onChange: (inv: InvoiceDto) => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setReason('');
    setError(null);
    onClose();
  }

  async function undo() {
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await undoPayment(invoice.id, payment.id, reason.trim() || null, invoice.updatedAt));
      setBusy(false);
      setReason('');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.current) onChange(err.current as InvoiceDto);
      setError(errorText(err, 'The payment couldn’t be undone'));
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!payment} onClose={close} locked={busy} labelledBy="undo-payment-title">
      <div className="rounded-[22px] bg-[var(--paper)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <h2 id="undo-payment-title" className="text-[19px] font-bold">
          Undo this payment?
        </h2>
        {payment ? (
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
            The {formatCents(payment.amountCents)} received {documentDate(payment.receivedOn)} goes back onto the balance due. It stays in the payments list, marked as undone.
          </p>
        ) : null}
        <div className="mt-3">
          <Field label="Why (optional)">
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. entered twice" className={inputClass} />
          </Field>
        </div>
        {error ? (
          <div className="mt-3">
            <Notice>{error}</Notice>
          </div>
        ) : null}
      </div>
      <div className="space-y-1 px-1 pt-3">
        <button type="button" onClick={undo} disabled={busy} className={buttonClass('danger', 'w-full py-3.5 text-[16px]')}>
          <Undo2 size={16} /> {busy ? 'Undoing…' : 'Undo payment'}
        </button>
        <button type="button" onClick={close} disabled={busy} className={buttonClass('ghost', 'w-full py-3 text-[15px]')}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
