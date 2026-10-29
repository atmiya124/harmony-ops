'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, Download, FileText, Mail, MoreHorizontal, Paperclip, ReceiptText, Send, Trash2 } from 'lucide-react';
import { ApiError } from '@/lib/apiClient';
import { cloneQuote, convertQuoteToInvoice, deleteQuote, sendQuote, setQuoteStatus, type QuoteDto } from '@/lib/quotesApi';
import { centsToInput, formatCents, parseAmountToCents } from '@/lib/money';
import { formatBp } from '@/lib/sales/inputs';
import { torontoDate } from '@/lib/sales/format';
import { CONTRACT_PAYMENT_DAYS, convertBlocker, defaultInvoiceDueDate } from '@/lib/sales/invoiceFromQuote';
import { groupBySection } from '@/lib/sales/quoteDraft';
import { canSetQuoteStatus, EMAILABLE_QUOTE_STATUSES, isQuoteEditable, quoteDeleteBlocker, QUOTE_STATUS_LABELS, type InvoicePaymentMethod } from '@/lib/sales/types';
import { buttonClass, ButtonLink, DateInput, Dialog, documentDate, Field, iconButtonClass, inputClass, Notice, PaymentMethodSelect } from './ui';

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError || err instanceof Error ? err.message : fallback);

// The Quote Details header: Send to client, Preview PDF, and a ⋯ menu
// (download, mark as sent, clone, delete).
export function QuoteHeaderActions({ quote, onChange }: { quote: QuoteDto; onChange: (q: QuoteDto) => void }) {
  const [sending, setSending] = useState(false);
  const pdf = `/api/quotes/${quote.id}/pdf`;
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setSending(true)} className={buttonClass('primary', 'h-10 w-10 px-0 py-0 md:w-auto md:px-4')} aria-label="Send to client" title="Send to client">
        <Send size={16} />
        <span className="hidden md:inline">Send</span>
      </button>
      {/* Phones: in the ⋯ menu instead, to leave room for the title. */}
      <span className="hidden md:block">
        <a href={pdf} target="_blank" rel="noopener" className={`${iconButtonClass('h-10 w-auto px-4')} gap-2 text-[14px] font-bold`}>
          <FileText size={17} /> Preview PDF
        </a>
      </span>
      <MoreMenu quote={quote} onChange={onChange} />
      <SendQuoteDialog quote={quote} open={sending} onClose={() => setSending(false)} onSent={onChange} />
    </div>
  );
}

// ---------------------------------------------------------------- send

// Why the quote can't be emailed right now, or null.
function sendBlocker(quote: QuoteDto): string | null {
  if (!quote.customerEmail) return 'This quote has no client email. Add one in Edit quote, then send it.';
  if (!EMAILABLE_QUOTE_STATUSES.includes(quote.status)) return `${QUOTE_STATUS_LABELS[quote.status]} quotes can’t be sent.`;
  return null;
}

function SendQuoteDialog({ quote, open, onClose, onSent }: { quote: QuoteDto; open: boolean; onClose: () => void; onSent: (q: QuoteDto) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sendId, setSendId] = useState<string>(() => crypto.randomUUID());
  const blocker = sendBlocker(quote);
  const groups = groupBySection(quote.items);

  function close() {
    if (busy) return;
    setError(null);
    setSentTo(null);
    onClose();
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const updated = await sendQuote(quote.id, quote.updatedAt, sendId);
      setSentTo(quote.customerEmail);
      setSendId(crypto.randomUUID()); // a later send is a new email
      onSent(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.current) onSent(err.current as QuoteDto);
      setError(errorText(err, 'The quote couldn’t be sent'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} locked={busy} labelledBy="send-quote-title">
      <div className="rounded-[22px] bg-[var(--paper)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {sentTo ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center" role="status">
            <CheckCircle2 size={36} className="text-[var(--ok)]" aria-hidden />
            <h2 id="send-quote-title" className="text-[19px] font-bold">
              Quote sent
            </h2>
            <p className="text-[14px] text-[var(--ink-2)]">
              {quote.quoteNumber} was emailed to <span className="font-semibold text-[var(--ink)]">{sentTo}</span> with the PDF and a link to accept it online.
            </p>
          </div>
        ) : (
          <>
            <h2 id="send-quote-title" className="text-[19px] font-bold">
              Send quote to client
            </h2>
            <dl className="mt-3 space-y-1.5 text-[14px]">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-[var(--ink-3)]">To</dt>
                <dd className="min-w-0 break-words">
                  {quote.customerName}
                  {quote.customerEmail ? <span className="text-[var(--ink-2)]"> &lt;{quote.customerEmail}&gt;</span> : <span className="text-[var(--bad)]"> — no email</span>}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-[var(--ink-3)]">Quote</dt>
                <dd>
                  {quote.quoteNumber} · valid until {documentDate(quote.validUntil)}
                </dd>
              </div>
            </dl>

            {/* What the client is being sent. */}
            <div className="mt-4 max-h-[34dvh] overflow-y-auto rounded-xl border border-[var(--line)]">
              {groups.map((g, gi) => (
                <div key={`${g.section}-${gi}`}>
                  <p className="sticky top-0 border-b border-[var(--line)] bg-[#f0f0f2] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em]">{g.section}</p>
                  <ul className="divide-y divide-[var(--line)]">
                    {g.items.map((item) => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-[13px]">
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{item.itemName}</span>
                          <span className="text-[var(--ink-3)]"> × {item.quantity}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatCents(item.netTotalCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <dl className="mt-4 space-y-1.5 text-[14px]">
              <Line label="Sub total" value={formatCents(quote.subtotalCents)} />
              {quote.discountCents > 0 ? <Line label="Discount" value={`−${formatCents(quote.discountCents)}`} tone="text-[var(--bad)]" /> : null}
              <Line label={quote.paymentMethod === 'cash' ? `No ${quote.taxLabel} (cash payment)` : `${quote.taxLabel} ${formatBp(quote.taxRateBp)}`} value={formatCents(quote.taxCents)} />
              <div className="flex items-baseline justify-between border-t border-[var(--line)] pt-2">
                <dt className="font-semibold">Total estimate</dt>
                <dd className="text-[18px] font-bold tabular-nums">
                  {formatCents(quote.totalCents)} <span className="text-[12px] font-semibold text-[var(--ink-3)]">{quote.currency}</span>
                </dd>
              </div>
              {quote.depositType !== 'none' && quote.depositRequiredCents > 0 ? (
                <Line label={`Deposit${quote.depositType === 'percent' ? ` (${formatBp(quote.depositValue)})` : ''}`} value={formatCents(quote.depositRequiredCents)} tone="text-[var(--ok)]" />
              ) : null}
            </dl>

            <p className="mt-4 flex items-start gap-2 text-[12px] leading-snug text-[var(--ink-3)]">
              <Paperclip size={14} className="mt-px shrink-0" aria-hidden />
              <span>
                The PDF is attached, with a button to view and accept the quote online.
                {quote.status === 'draft' ? ' Sending marks this draft as Sent.' : ''}
              </span>
            </p>
            {blocker || error ? (
              <div className="mt-3">
                <Notice>{blocker ?? error}</Notice>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-1 px-1 pt-3">
        {sentTo ? (
          <button type="button" onClick={close} className={buttonClass('primary', 'w-full py-3.5 text-[16px]')}>
            Done
          </button>
        ) : (
          <>
            {blocker && !quote.customerEmail && isQuoteEditable(quote.status) ? (
              <ButtonLink href={`/quotes/${quote.id}/edit`} className="w-full py-3.5 text-[16px]">
                Add client email
              </ButtonLink>
            ) : (
              <button type="button" onClick={send} disabled={busy || !!blocker} className={buttonClass('primary', 'w-full py-3.5 text-[16px]')}>
                <Mail size={17} /> {busy ? 'Sending…' : 'Send to client'}
              </button>
            )}
            <button type="button" onClick={close} disabled={busy} className={buttonClass('ghost', 'w-full py-3 text-[15px]')}>
              Cancel
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}

function Line({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${tone}`}>
      <dt className={tone ? '' : 'text-[var(--ink-2)]'}>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- ⋯ menu

const menuItemClass = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium transition hover:bg-[#f0f0f2] disabled:pointer-events-none disabled:opacity-40';

function MoreMenu({ quote, onChange }: { quote: QuoteDto; onChange: (q: QuoteDto) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pdf = `/api/quotes/${quote.id}/pdf`;
  const deleteBlocker = quoteDeleteBlocker(quote.status, quote.invoices.length);

  // Close on a click elsewhere or Esc.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.current) onChange(err.current as QuoteDto);
      setError(errorText(err, fallback));
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  const markSent = () =>
    run(async () => {
      onChange(await setQuoteStatus(quote.id, 'sent', quote.updatedAt));
      setOpen(false);
    }, 'Couldn’t mark it as sent');

  const clone = () =>
    run(async () => {
      const copy = await cloneQuote(quote.id, crypto.randomUUID());
      router.push(`/quotes/${copy.id}/edit`);
    }, 'Couldn’t clone the quote');

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="More actions" title="More actions" className={iconButtonClass()}>
        <MoreHorizontal size={18} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-12 z-30 w-60 rounded-2xl bg-[var(--paper)] p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.14)] ring-1 ring-black/[0.06]">
          <a role="menuitem" href={pdf} target="_blank" rel="noopener" className={`${menuItemClass} md:hidden`} onClick={() => setOpen(false)}>
            <FileText size={16} /> Preview PDF
          </a>
          <a role="menuitem" href={`${pdf}?download=1`} download className={menuItemClass} onClick={() => setOpen(false)}>
            <Download size={16} /> Download PDF
          </a>
          {quote.invoices.map((inv) => (
            <Link key={inv.id} role="menuitem" href={`/invoices/${inv.id}`} className={menuItemClass} onClick={() => setOpen(false)}>
              <ReceiptText size={16} /> View invoice {inv.invoiceNumber}
            </Link>
          ))}
          {canSetQuoteStatus(quote.status, 'sent') ? (
            <button role="menuitem" type="button" disabled={busy} onClick={markSent} className={menuItemClass}>
              <Send size={16} /> Mark as sent
            </button>
          ) : null}
          <button role="menuitem" type="button" disabled={busy} onClick={clone} className={menuItemClass}>
            <Copy size={16} /> {busy ? 'Working…' : 'Clone'}
          </button>
          <div className="my-1 border-t border-[var(--line)]" />
          <button
            role="menuitem"
            type="button"
            disabled={busy || !!deleteBlocker}
            onClick={() => {
              setOpen(false);
              setConfirmDelete(true);
            }}
            className={`${menuItemClass} text-[var(--bad)]`}
          >
            <Trash2 size={16} /> Delete
          </button>
          {deleteBlocker ? <p className="px-3 pb-1.5 text-[12px] text-[var(--ink-3)]">{deleteBlocker}</p> : null}
          {error ? (
            <div className="px-1 pb-1 pt-1">
              <Notice>{error}</Notice>
            </div>
          ) : null}
        </div>
      ) : null}
      <DeleteDialog quote={quote} open={confirmDelete} onClose={() => setConfirmDelete(false)} onChange={onChange} />
    </div>
  );
}

// ---------------------------------------------------------------- convert

// Turns an accepted quote into its invoice. The items and figures are
// copied exactly; staff choose the due date and record a deposit the
// client has already paid, which comes off the balance due.
export function ConvertToInvoiceDialog({ quote, open, onClose, onChange }: { quote: QuoteDto; open: boolean; onClose: () => void; onChange: (q: QuoteDto) => void }) {
  const today = torontoDate(new Date().toISOString());
  const [invoiceId] = useState<string>(() => crypto.randomUUID());
  const [dueDate, setDueDate] = useState(() => defaultInvoiceDueDate(quote, today));
  const [depositReceived, setDepositReceived] = useState(false);
  const [depositInput, setDepositInput] = useState(() => centsToInput(quote.depositRequiredCents));
  const [depositMethod, setDepositMethod] = useState<InvoicePaymentMethod>(() => quote.paymentMethod ?? 'etransfer');
  const [depositOn, setDepositOn] = useState(today);
  const [poNumber, setPoNumber] = useState(() => quote.clientPoNumber ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; invoiceNumber: string } | null>(null);

  const deposit = depositReceived ? parseAmountToCents(depositInput, quote.totalCents) : ({ ok: true, cents: 0 } as const);
  const depositCents = deposit.ok ? deposit.cents : 0;
  const dueError = !dueDate ? 'Choose a due date' : dueDate < today ? 'Can’t be before today' : null;
  const depositOnError = !depositReceived ? null : !depositOn ? 'Choose the date' : depositOn > today ? 'Can’t be after today' : null;
  const blocker = convertBlocker(quote.status);
  const dueHint = quote.clientType === 'contract' ? `Contract terms: ${CONTRACT_PAYMENT_DAYS} days` : quote.eventDate && quote.eventDate > today ? 'Regular terms: balance due on the event day' : undefined;

  function close() {
    if (busy) return;
    setError(null);
    onClose();
  }

  async function convert() {
    setBusy(true);
    setError(null);
    try {
      const updated = await convertQuoteToInvoice(quote.id, {
        invoiceId,
        expectedUpdatedAt: quote.updatedAt,
        dueDate,
        depositPaidCents: depositCents,
        depositMethod: depositCents > 0 ? depositMethod : null,
        depositReceivedOn: depositCents > 0 ? depositOn : null,
        clientPoNumber: poNumber.trim() || null,
      });
      const invoice = updated.invoices.find((i) => i.id === invoiceId) ?? updated.invoices.at(-1);
      if (invoice) setCreated(invoice);
      onChange(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.current) onChange(err.current as QuoteDto);
      setError(errorText(err, 'The invoice couldn’t be created'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} locked={busy} labelledBy="convert-quote-title">
      <div className="rounded-[22px] bg-[var(--paper)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {created ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center" role="status">
            <CheckCircle2 size={36} className="text-[var(--ok)]" aria-hidden />
            <h2 id="convert-quote-title" className="text-[19px] font-bold">
              Invoice {created.invoiceNumber} created
            </h2>
            <p className="text-[14px] text-[var(--ink-2)]">
              {quote.quoteNumber} is now marked Converted. Review the invoice, then send it to {quote.customerName}.
            </p>
          </div>
        ) : (
          <>
            <h2 id="convert-quote-title" className="text-[19px] font-bold">
              Convert to invoice
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
              A new invoice for <span className="font-semibold text-[var(--ink)]">{quote.customerName}</span> with the same {quote.items.length} item{quote.items.length === 1 ? '' : 's'}, pricing, notes and terms as {quote.quoteNumber}, dated today. The quote is then marked Converted and stays locked.
            </p>

            <div className="mt-4 space-y-3">
              <Field label="Due date" error={dueError ?? undefined} hint={dueHint}>
                <DateInput value={dueDate} onChange={setDueDate} min={today} invalid={!!dueError} />
              </Field>
              <Field label="Client PO # (optional)" hint="If their accounts team needs it to pay. You can add it later too.">
                <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} maxLength={60} autoComplete="off" className={inputClass} />
              </Field>
              <label className="flex items-start gap-2.5 text-[14px]">
                <input type="checkbox" checked={depositReceived} onChange={(e) => setDepositReceived(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ink)]" />
                <span>
                  Deposit already received
                  {quote.depositRequiredCents > 0 ? <span className="block text-[12px] text-[var(--ink-3)]">The quote asked for {formatCents(quote.depositRequiredCents)}</span> : null}
                </span>
              </label>
              {depositReceived ? (
                <>
                  <Field label="Deposit received" error={deposit.ok ? undefined : deposit.error}>
                    <input inputMode="decimal" value={depositInput} onChange={(e) => setDepositInput(e.target.value)} aria-invalid={!deposit.ok || undefined} className={inputClass} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Paid by">
                      <PaymentMethodSelect value={depositMethod} onChange={setDepositMethod} />
                    </Field>
                    <Field label="Received on" error={depositOnError ?? undefined}>
                      <DateInput value={depositOn} onChange={setDepositOn} max={today} invalid={!!depositOnError} />
                    </Field>
                  </div>
                </>
              ) : null}
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-[var(--line)] pt-3 text-[14px]">
              <Line label="Invoice total" value={formatCents(quote.totalCents)} />
              {depositCents > 0 ? <Line label="Deposit paid" value={`−${formatCents(depositCents)}`} tone="text-[var(--ok)]" /> : null}
              <div className="flex items-baseline justify-between border-t border-[var(--line)] pt-2">
                <dt className="font-semibold">Balance due</dt>
                <dd className="text-[18px] font-bold tabular-nums">
                  {formatCents(quote.totalCents - depositCents)} <span className="text-[12px] font-semibold text-[var(--ink-3)]">{quote.currency}</span>
                </dd>
              </div>
            </dl>
            {blocker || error ? (
              <div className="mt-3">
                <Notice>{blocker ?? error}</Notice>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-1 px-1 pt-3">
        {created ? (
          <>
            <ButtonLink href={`/invoices/${created.id}`} className="w-full py-3.5 text-[16px]">
              <ReceiptText size={17} /> View invoice
            </ButtonLink>
            <a href={`/api/invoices/${created.id}/pdf`} target="_blank" rel="noopener" className={buttonClass('secondary', 'w-full py-3 text-[15px]')}>
              <FileText size={16} /> Preview PDF
            </a>
            <button type="button" onClick={close} className={buttonClass('ghost', 'w-full py-3 text-[15px]')}>
              Done
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={convert} disabled={busy || !!blocker || !!dueError || !deposit.ok || !!depositOnError} className={buttonClass('primary', 'w-full py-3.5 text-[16px]')}>
              <ReceiptText size={17} /> {busy ? 'Creating invoice…' : 'Create invoice'}
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

function DeleteDialog({ quote, open, onClose, onChange }: { quote: QuoteDto; open: boolean; onClose: () => void; onChange: (q: QuoteDto) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteQuote(quote.id, quote.updatedAt);
      router.replace('/quotes');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.current) onChange(err.current as QuoteDto);
      setError(errorText(err, 'The quote couldn’t be deleted'));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) {
          setError(null);
          onClose();
        }
      }}
      locked={busy}
      labelledBy="delete-quote-title"
    >
      <div className="rounded-[22px] bg-[var(--paper)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <h2 id="delete-quote-title" className="text-[19px] font-bold">
          Delete {quote.quoteNumber}?
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
          The quote for <span className="font-semibold text-[var(--ink)]">{quote.customerName}</span> ({formatCents(quote.totalCents)}) is removed from your quotes, and its client link stops working.
        </p>
        {error ? (
          <div className="mt-3">
            <Notice>{error}</Notice>
          </div>
        ) : null}
      </div>
      <div className="space-y-1 px-1 pt-3">
        <button type="button" onClick={remove} disabled={busy} className={buttonClass('danger', 'w-full py-3.5 text-[16px]')}>
          <Trash2 size={16} /> {busy ? 'Deleting…' : 'Delete quote'}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className={buttonClass('ghost', 'w-full py-3 text-[15px]')}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
