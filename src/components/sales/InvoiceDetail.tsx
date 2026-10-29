'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Download, FileText, Pencil, Plus } from 'lucide-react';
import { ApiError } from '@/lib/apiClient';
import { updateInvoicePo, type InvoiceDto } from '@/lib/quotesApi';
import { formatCents } from '@/lib/money';
import { formatBp } from '@/lib/sales/inputs';
import { torontoDate } from '@/lib/sales/format';
import { INVOICE_STATUS_LABELS } from '@/lib/sales/types';
import { paidRow } from '@/lib/documents/documentModel';
import { CustomerCard, EventCard, ItemsCard, NotesAndTermsCards, SummaryRow as Row } from './documentCards';
import { PaymentsCard, RecordPaymentButton } from './InvoicePayments';
import PaymentProgress from './PaymentProgress';
import { buttonClass, Dialog, documentDate, Field, inputClass, invoiceStatusColor, Notice, PaidStamp } from './ui';

// An invoice, in the same layout as Quote Details: the balance due and
// status first, the payments received, then the document in print order
// (bill to and event, items, notes and terms); beside it a panel that stays
// in view with the totals, details, Record payment and the PDF.
export default function InvoiceDetail({ invoice, onChange }: { invoice: InvoiceDto; onChange: (inv: InvoiceDto) => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-10">
      <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
        <Hero invoice={invoice} onChange={onChange} />
      </div>

      <aside className="order-5 lg:sticky lg:top-4 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <SidePanel invoice={invoice} onChange={onChange} />
      </aside>

      <div className="contents min-w-0 lg:col-start-1 lg:row-start-2 lg:block lg:space-y-5">
        {/* Phones: payments right under the balance. */}
        <div className="order-2 lg:order-none">
          <PaymentsCard invoice={invoice} onChange={onChange} />
        </div>
        <div className="order-3 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 lg:order-none">
          <CustomerCard doc={invoice} heading="Bill to" />
          <EventCard doc={invoice} />
        </div>
        <div className="order-4 min-w-0 lg:order-none">
          <ItemsCard items={invoice.items} />
        </div>
        <div className="order-6 space-y-5 lg:order-none">
          <NotesAndTermsCards notes={invoice.notes} terms={invoice.terms} emptyTerms="No terms on this invoice." />
        </div>
      </div>
    </div>
  );
}

const today = () => torontoDate(new Date().toISOString());

// Unpaid (and not void) past its due date.
function isOverdue(invoice: InvoiceDto): boolean {
  return invoice.status !== 'paid' && invoice.status !== 'void' && invoice.balanceDueCents > 0 && invoice.dueDate < today();
}

// The status and when it happened, from the invoice's own timestamps.
function statusLine(invoice: InvoiceDto): string {
  if (invoice.status === 'void') return `Void${invoice.voidedAt ? ` · ${documentDate(torontoDate(invoice.voidedAt))}` : ''}`;
  if (invoice.status === 'paid') return `Paid in full${invoice.paidAt ? ` · ${documentDate(torontoDate(invoice.paidAt))}` : ''}`;
  if (isOverdue(invoice)) return `Overdue · was due ${documentDate(invoice.dueDate)}`;
  if (invoice.status === 'draft') return `Draft · not sent yet · due ${documentDate(invoice.dueDate)}`;
  return `${INVOICE_STATUS_LABELS[invoice.status]} · due ${documentDate(invoice.dueDate)}`;
}

function Hero({ invoice, onChange }: { invoice: InvoiceDto; onChange: (inv: InvoiceDto) => void }) {
  const who = [invoice.customerName, invoice.customerCompany].filter(Boolean).join(' · ');
  const paidCents = invoice.depositPaidCents + invoice.amountPaidCents;
  const overdue = isOverdue(invoice);
  return (
    <section className="pt-1">
      <p className="text-[13px] font-medium text-[var(--ink-3)]">Balance due</p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="text-[38px] font-bold leading-none tracking-tight tabular-nums md:text-[44px]">{formatCents(invoice.balanceDueCents)}</span>
        <span className="text-[15px] font-semibold text-[var(--ink-3)]">{invoice.currency}</span>
      </p>
      <p
        className="mt-2 text-[17px] font-semibold"
        style={{
          color: overdue ? 'var(--bad)' : invoiceStatusColor(invoice.status),
        }}
      >
        {statusLine(invoice)}
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
        <HeroFact label="Billed to" value={who} />
        {invoice.clientPoNumber ? <HeroFact label="PO" value={invoice.clientPoNumber} /> : null}
        {invoice.eventName || invoice.eventDate ? (
          <HeroFact label="Event" value={[invoice.eventName, invoice.eventDate ? documentDate(invoice.eventDate) : null].filter(Boolean).join(' · ')} />
        ) : null}
      </dl>
      {invoice.quoteId && invoice.quoteNumber ? (
        <p className="mt-1.5 text-[13px] text-[var(--ink-3)]">
          From quote{' '}
          <Link
            href={`/quotes/${invoice.quoteId}`}
            className="inline-flex items-center gap-0.5 font-semibold text-[var(--accent-ink)] underline decoration-[var(--accent-ink)]/40 underline-offset-[3px] hover:decoration-[var(--accent-ink)]"
          >
            {invoice.quoteNumber}
            <ArrowUpRight size={13} aria-hidden />
          </Link>
          {invoice.quoteAcceptedAt ? `, accepted ${documentDate(torontoDate(invoice.quoteAcceptedAt))}` : ''}
        </p>
      ) : null}

      {/* How the paid amount has grown toward the total, and the button to add a payment. */}
      {invoice.status !== 'void' ? (
        <div className="mt-4 flex max-w-xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <PaymentProgress invoice={invoice} />
            <ProgressCaption invoice={invoice} paidCents={paidCents} />
          </div>
          <div className="shrink-0">
            {/* Paid in full: the stamp, where the Record payment button was
                (which hides itself, but stays mounted to show its result). */}
            {invoice.status === 'paid' ? <PaidStamp /> : null}
            <RecordPaymentButton invoice={invoice} onChange={onChange} compact />
          </div>
        </div>
      ) : null}
    </section>
  );
}

// Under the paid bar: what it adds up to, and the share paid at its end.
function ProgressCaption({ invoice, paidCents }: { invoice: InvoiceDto; paidCents: number }) {
  const count = invoice.payments.filter((p) => !p.voidedAt).length;
  const payments = `${count} payment${count === 1 ? '' : 's'}`;
  const share = invoice.totalCents > 0 ? Math.min(100, Math.floor((paidCents / invoice.totalCents) * 100)) : 100;
  const paidInFull = invoice.balanceDueCents <= 0;
  return (
    <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[13px] text-[var(--ink-3)]">
      <p className="min-w-0 truncate">
        {paidInFull ? (
          <>
            <span className="font-semibold text-[var(--ink-2)]">{formatCents(paidCents)}</span> received in {payments}
          </>
        ) : count === 0 ? (
          <>Nothing paid yet</>
        ) : (
          <>
            <span className="font-semibold text-[var(--ink-2)]">{formatCents(paidCents)}</span> of {formatCents(invoice.totalCents)} paid · {payments}
          </>
        )}
      </p>
      <span className={`shrink-0 font-semibold tabular-nums ${paidInFull ? 'text-[var(--ok)]' : 'text-[var(--ink-2)]'}`}>{share}%</span>
    </div>
  );
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--ink-3)]">{label}</dt>
      <dd className="truncate font-medium text-[var(--ink-2)]">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- side panel

function SidePanel({ invoice, onChange }: { invoice: InvoiceDto; onChange: (inv: InvoiceDto) => void }) {
  const [tab, setTab] = useState<'totals' | 'details'>('totals');
  const pdf = `/api/invoices/${invoice.id}/pdf`;
  return (
    <div className="rounded-[28px] bg-[var(--tray)] p-2">
      <div className="rounded-[22px] bg-[var(--paper)] px-5 pb-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div role="tablist" aria-label="Invoice summary" className="mb-4 grid grid-cols-2 border-b border-[var(--line)]">
          {(['totals', 'details'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 pb-3 pt-4 text-[17px] transition ${tab === t ? 'border-[var(--ink)] font-bold text-[var(--ink)]' : 'border-transparent font-medium text-[var(--ink-3)] hover:text-[var(--ink-2)]'}`}
            >
              {t === 'totals' ? 'Totals' : 'Details'}
            </button>
          ))}
        </div>
        {tab === 'totals' ? <Totals invoice={invoice} /> : <Details invoice={invoice} onChange={onChange} />}
      </div>

      <div className="space-y-1 px-1 pt-3">
        <a href={pdf} target="_blank" rel="noopener" className={buttonClass('primary', 'w-full py-3.5 text-[16px]')}>
          <FileText size={16} /> Preview PDF
        </a>
        <a href={`${pdf}?download=1`} download className={buttonClass('ghost', 'w-full py-3 text-[15px]')}>
          <Download size={16} /> Download PDF
        </a>
      </div>
      {invoice.status === 'void' && invoice.voidReason ? (
        <div className="px-1 pb-1 pt-2">
          <Notice>Voided: {invoice.voidReason}</Notice>
        </div>
      ) : null}
    </div>
  );
}

function Totals({ invoice }: { invoice: InvoiceDto }) {
  const paid = paidRow(invoice); // as the PDF prints it
  const itemDiscountsCents = invoice.items.reduce((sum, i) => sum + i.discountCents, 0);
  return (
    <dl className="space-y-3 text-[14px]">
      {itemDiscountsCents > 0 ? (
        <>
          <Row label="Items" value={formatCents(invoice.subtotalCents + itemDiscountsCents)} />
          <Row label="Item discounts" value={`−${formatCents(itemDiscountsCents)}`} tone="text-[var(--bad)]" />
        </>
      ) : null}
      <Row label="Sub total" value={formatCents(invoice.subtotalCents)} />
      {invoice.discountType !== 'none' ? (
        <Row label={`Discount${invoice.discountType === 'percent' ? ` ${formatBp(invoice.discountValue)}` : ''}`} value={`−${formatCents(invoice.discountCents)}`} tone="text-[var(--bad)]" />
      ) : null}
      {invoice.taxRateBp > 0 || invoice.taxCents > 0 ? (
        <Row label={`${invoice.taxLabel} ${formatBp(invoice.taxRateBp)}`} value={formatCents(invoice.taxCents)} />
      ) : (
        <Row label={`No ${invoice.taxLabel}`} value={formatCents(0)} />
      )}
      <Row label="Invoice total" value={formatCents(invoice.totalCents)} />
      {/* Quieter than the total and balance it sits between. */}
      {paid ? (
        <div className="flex items-baseline justify-between gap-4 text-[13px] text-[var(--ok)]">
          <dt>{paid.label}</dt>
          <dd className="shrink-0 font-medium tabular-nums">−{formatCents(paid.cents)}</dd>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between border-t border-[var(--line)] pt-3">
        <dt className="font-semibold">Balance due</dt>
        <dd className="text-[18px] font-bold tabular-nums">
          {formatCents(invoice.balanceDueCents)} <span className="text-[12px] font-semibold text-[var(--ink-3)]">{invoice.currency}</span>
        </dd>
      </div>
    </dl>
  );
}

function Details({ invoice, onChange }: { invoice: InvoiceDto; onChange: (inv: InvoiceDto) => void }) {
  const overdue = isOverdue(invoice);
  const [editingPo, setEditingPo] = useState(false);
  const canEditPo = invoice.status !== 'void';
  return (
    <dl className="space-y-3 text-[14px]">
      <Row label="Invoice №" value={invoice.invoiceNumber} />
      <Row label="Invoice date" value={documentDate(invoice.invoiceDate)} />
      <div className={`flex items-baseline justify-between gap-4 ${overdue ? 'text-[var(--bad)]' : ''}`}>
        <dt className={overdue ? 'flex items-center gap-1' : 'text-[var(--ink-2)]'}>
          {overdue ? <AlertTriangle size={13} aria-hidden /> : null}
          Due date
        </dt>
        <dd className="font-semibold tabular-nums">{documentDate(invoice.dueDate)}</dd>
      </div>
      {invoice.quoteNumber ? <Row label="Quote ref" value={invoice.quoteNumber} /> : null}
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-[var(--ink-2)]">Client PO #</dt>
        <dd className="flex min-w-0 items-baseline gap-2">
          {invoice.clientPoNumber ? <span className="truncate font-semibold tabular-nums">{invoice.clientPoNumber}</span> : canEditPo ? null : <span className="text-[var(--ink-3)]">None</span>}
          {canEditPo ? (
            <button type="button" onClick={() => setEditingPo(true)} className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-[var(--accent-ink)] hover:underline">
              {invoice.clientPoNumber ? <Pencil size={12} aria-hidden /> : <Plus size={13} aria-hidden />}
              {invoice.clientPoNumber ? 'Edit' : 'Add'}
            </button>
          ) : null}
        </dd>
      </div>
      <PoDialog key={String(editingPo)} invoice={invoice} open={editingPo} onClose={() => setEditingPo(false)} onChange={onChange} />
      {invoice.sentAt ? <Row label="Sent" value={documentDate(torontoDate(invoice.sentAt))} /> : null}
      <Row label="Payment on PDF" value={invoice.showPaymentDetails ? 'Shown' : 'Hidden'} />
      <Row label="Created by" value={invoice.createdByEmail} />
    </dl>
  );
}

// Adds, changes or clears the client's PO number; it prints on the PDF.
function PoDialog({ invoice, open, onClose, onChange }: { invoice: InvoiceDto; open: boolean; onClose: () => void; onChange: (inv: InvoiceDto) => void }) {
  const [value, setValue] = useState(invoice.clientPoNumber ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onChange(await updateInvoicePo(invoice.id, value.trim() || null, invoice.updatedAt));
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.current) onChange(err.current as InvoiceDto);
      setError(err instanceof Error ? err.message : 'The PO number couldn’t be saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} locked={busy} labelledBy="invoice-po-title">
      <form onSubmit={save} className="rounded-[22px] bg-[var(--paper)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <h2 id="invoice-po-title" className="text-[19px] font-bold">
          Client PO #
        </h2>
        <p className="mt-2 text-[14px] text-[var(--ink-2)]">The purchase order number {invoice.customerName} gave you. It prints on the invoice so their accounts team can match it. Leave blank to remove it.</p>
        <div className="mt-4">
          <Field label="PO number">
            <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} autoComplete="off" autoFocus className={inputClass} />
          </Field>
        </div>
        {error ? (
          <div className="mt-3">
            <Notice>{error}</Notice>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass('ghost')}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={buttonClass('primary')}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
