'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronsUpDown, Lock, Mail, Pencil, ReceiptText } from 'lucide-react';
import { ApiError } from '@/lib/apiClient';
import { setQuoteStatus, type QuoteDto } from '@/lib/quotesApi';
import { formatCents } from '@/lib/money';
import { formatBp } from '@/lib/sales/inputs';
import { activityDateTime, torontoDate } from '@/lib/sales/format';
import { canSetQuoteStatus, isQuoteEditable, MANUAL_QUOTE_STATUSES, QUOTE_CLIENT_TYPE_LABELS, QUOTE_PAYMENT_METHOD_LABELS, QUOTE_STATUS_LABELS, type QuoteStatus } from '@/lib/sales/types';
import ClientLinkCard from './ClientLinkCard';
import { CustomerCard, EventCard, ItemsCard, NotesAndTermsCards, SummaryRow as Row } from './documentCards';
import { ConvertToInvoiceDialog } from './QuoteActions';
import { buttonClass, ButtonLink, Card, documentDate, Eyebrow, InvoiceStatusBadge, Notice, PdfActions, quoteStatusColor } from './ui';

// Read-only view of a saved quote. The headline total and status first, then
// the document in print order (items, customer and event, notes and terms);
// beside it a panel that stays in view with the totals and details, the
// main action and the status control.
export default function QuoteDetail({ quote, onChange }: { quote: QuoteDto; onChange: (q: QuoteDto) => void }) {
  return (
    // Phones: one column in `order-*` order — amount, client link, customer
    // and event, items, the totals panel, then notes and terms. Desktop: the
    // main column on the left (the column div is `contents` on phones so its
    // blocks can be ordered around the panel) and the panel on the right.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-10">
      <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
        <Hero quote={quote} />
      </div>

      <aside className="order-5 lg:sticky lg:top-4 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <SidePanel quote={quote} onChange={onChange} />
      </aside>

      <div className="contents min-w-0 lg:col-start-1 lg:row-start-2 lg:block lg:space-y-5">
        {/* First, so the client's answer (and signature) is seen at once. */}
        <div className="order-2 lg:order-none">
          <ClientLinkCard quote={quote} onQuoteChange={onChange} />
        </div>
        <div className="order-3 lg:order-none">
          <People quote={quote} />
        </div>
        <div className="order-4 min-w-0 lg:order-none">
          <ItemsCard items={quote.items} />
        </div>
        <div className="order-6 space-y-5 lg:order-none">
          <NotesAndTerms quote={quote} />
        </div>
      </div>
    </div>
  );
}

// The status and when it happened, from the status's own timestamp.
function statusLine(quote: QuoteDto): string {
  if (quote.status === 'draft') return 'Draft · not sent yet';
  if (quote.status === 'expired') return `Expired ${documentDate(quote.validUntil)}`;
  const since = quote.statusChangedAt ? ` · ${documentDate(torontoDate(quote.statusChangedAt))}` : '';
  return `${QUOTE_STATUS_LABELS[quote.status]}${since}`;
}

// The invoice made from this quote (the newest, should there be several).
function latestInvoice(quote: QuoteDto): QuoteDto['invoices'][number] | null {
  return quote.invoices.at(-1) ?? null;
}

function Hero({ quote }: { quote: QuoteDto }) {
  const who = [quote.customerName, quote.customerCompany].filter(Boolean).join(' · ');
  const invoice = latestInvoice(quote);
  return (
    <section className="pt-1">
      <p className="flex items-baseline gap-2">
        <span className="text-[38px] font-bold leading-none tracking-tight tabular-nums md:text-[44px]">{formatCents(quote.totalCents)}</span>
        <span className="text-[15px] font-semibold text-[var(--ink-3)]">{quote.currency}</span>
      </p>
      <p className="mt-2 text-[17px] font-semibold" style={{ color: quoteStatusColor(quote.status) }}>
        {statusLine(quote)}
      </p>
      <p className="mt-1 truncate text-[14px] text-[var(--ink-2)]">
        {who}
        {quote.eventName ? <span className="text-[var(--ink-3)]"> — {quote.eventName}</span> : null}
      </p>
      {invoice ? (
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--ink-3)]">
          <ReceiptText size={13} aria-hidden />
          <span>
            Invoiced as{' '}
            <Link href={`/invoices/${invoice.id}`} className="font-medium text-[var(--accent-ink)] hover:underline">
              {invoice.invoiceNumber}
            </Link>
          </span>
        </p>
      ) : null}
      <EmailSummary quote={quote} />
    </section>
  );
}

// When the quote was last emailed, and how often — one quiet line. With
// more than one email, the count opens the list of send times.
function EmailSummary({ quote }: { quote: QuoteDto }) {
  const sends = quote.emailSends;
  if (sends.length === 0) return null;
  const last = sends[0];
  return (
    <div className="mt-2 text-[13px] text-[var(--ink-3)]">
      <p className="flex items-start gap-x-1.5">
        <Mail size={13} className="mt-[3px] shrink-0" aria-hidden />
        {sends.length === 1 ? (
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Sent to <span className="text-[var(--ink-2)]">{last.recipientEmail}</span> · {activityDateTime(last.sentAt)}
          </span>
        ) : (
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Last sent {activityDateTime(last.sentAt)} to <span className="text-[var(--ink-2)]">{last.recipientEmail}</span>
          </span>
        )}
      </p>
      {sends.length > 1 ? (
        <details className="group mt-0.5 pl-[19px]">
          <summary className="w-fit cursor-pointer list-none text-[var(--ink-2)] underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
            {sends.length} emails sent
          </summary>
          <ol className="mt-1 space-y-0.5">
            {sends.map((s, i) => (
              <li key={`${s.sentAt}-${i}`}>
                {activityDateTime(s.sentAt)} · {s.recipientEmail}
                {s.kind === 'first' ? ' · first send' : ''}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- side panel

// A grey tray holding a white card (Totals / Details), the main action and
// the status control under it.
function SidePanel({ quote, onChange }: { quote: QuoteDto; onChange: (q: QuoteDto) => void }) {
  const [tab, setTab] = useState<'totals' | 'details'>('totals');
  const [converting, setConverting] = useState(false);
  const editable = isQuoteEditable(quote.status);
  const invoice = latestInvoice(quote);
  return (
    <div className="rounded-[28px] bg-[var(--tray)] p-2">
      <div className="rounded-[22px] bg-[var(--paper)] px-5 pb-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div role="tablist" aria-label="Quote summary" className="mb-4 grid grid-cols-2 border-b border-[var(--line)]">
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
        {tab === 'totals' ? <Totals quote={quote} /> : <Details quote={quote} />}
      </div>

      <div className="px-1 pt-3">
        {editable ? (
          <ButtonLink href={`/quotes/${quote.id}/edit`} className="w-full py-3.5 text-[16px]">
            <Pencil size={16} /> Edit quote
          </ButtonLink>
        ) : quote.status === 'accepted' ? (
          <button type="button" onClick={() => setConverting(true)} className={buttonClass('primary', 'w-full py-3.5 text-[16px]')}>
            <ReceiptText size={16} /> Convert to invoice
          </button>
        ) : invoice ? (
          <ButtonLink href={`/invoices/${invoice.id}`} className="w-full py-3.5 text-[16px]">
            <ReceiptText size={16} /> View invoice {invoice.invoiceNumber}
          </ButtonLink>
        ) : (
          <span className={buttonClass('ghost', 'pointer-events-none w-full bg-[var(--line-strong)] py-3.5 text-[16px]')} aria-disabled>
            <Lock size={16} /> {QUOTE_STATUS_LABELS[quote.status]} quotes are locked
          </span>
        )}
      </div>
      <StatusControl quote={quote} onChange={onChange} />
      {/* Stays mounted once the quote turns Converted, to show the result. */}
      <ConvertToInvoiceDialog quote={quote} open={converting} onClose={() => setConverting(false)} onChange={onChange} />
    </div>
  );
}

function Totals({ quote }: { quote: QuoteDto }) {
  return (
    <dl className="space-y-3 text-[14px]">
      {quote.itemDiscountsCents > 0 ? (
        <>
          <Row label="Items" value={formatCents(quote.subtotalCents + quote.itemDiscountsCents)} />
          <Row label="Item discounts" value={`−${formatCents(quote.itemDiscountsCents)}`} tone="text-[var(--bad)]" />
        </>
      ) : null}
      <Row label="Sub total" value={formatCents(quote.subtotalCents)} />
      {quote.discountType !== 'none' ? (
        <Row label={`Discount${quote.discountType === 'percent' ? ` ${formatBp(quote.discountValue)}` : ''}`} value={`−${formatCents(quote.discountCents)}`} tone="text-[var(--bad)]" />
      ) : null}
      <Row label={quote.paymentMethod === 'cash' ? `No ${quote.taxLabel} (cash payment)` : `${quote.taxLabel} ${formatBp(quote.taxRateBp)}`} value={formatCents(quote.taxCents)} />
      <div className="flex items-baseline justify-between border-t border-[var(--line)] pt-3">
        <dt className="font-semibold">Total estimate</dt>
        <dd className="text-[18px] font-bold tabular-nums">
          {formatCents(quote.totalCents)} <span className="text-[12px] font-semibold text-[var(--ink-3)]">{quote.currency}</span>
        </dd>
      </div>
      {quote.depositType !== 'none' ? (
        <Row label={`Deposit required${quote.depositType === 'percent' ? ` (${formatBp(quote.depositValue)})` : ''}`} value={formatCents(quote.depositRequiredCents)} tone="text-[var(--ok)]" />
      ) : null}
    </dl>
  );
}

function Details({ quote }: { quote: QuoteDto }) {
  return (
    <dl className="space-y-3 text-[14px]">
      <Row label="Quote №" value={quote.quoteNumber} />
      <Row label="Quote date" value={documentDate(quote.quoteDate)} />
      <Row label="Valid until" value={documentDate(quote.validUntil)} />
      {quote.clientPoNumber ? <Row label="Client PO #" value={quote.clientPoNumber} /> : null}
      <Row label="Payment method" value={quote.paymentMethod ? QUOTE_PAYMENT_METHOD_LABELS[quote.paymentMethod] : 'Not specified'} />
      <Row label="Deposit" value={quote.depositType === 'none' ? 'None' : formatCents(quote.depositRequiredCents)} />
      <Row label="Payment on PDF" value={quote.showPaymentDetails ? 'Shown' : 'Hidden'} />
      <Row label="Created by" value={quote.createdByEmail} />
    </dl>
  );
}

// Manual status changes, as a quiet row under the main action.
function StatusControl({ quote, onChange }: { quote: QuoteDto; onChange: (q: QuoteDto) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = MANUAL_QUOTE_STATUSES.filter((s) => canSetQuoteStatus(quote.status, s));
  if (options.length === 0) return null;

  async function change(status: QuoteStatus) {
    setSaving(true);
    setError(null);
    try {
      onChange(await setQuoteStatus(quote.id, status, quote.updatedAt));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.current) onChange(err.current as QuoteDto);
      setError(err instanceof Error ? err.message : 'Could not change the status');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-1 pb-1 pt-1">
      <label className="relative flex items-center justify-between rounded-full px-4 py-3.5 transition hover:bg-black/[0.03]">
        <span className="text-[15px] font-semibold">{saving ? 'Saving…' : 'Mark quote as…'}</span>
        <ChevronsUpDown size={18} className="text-[var(--ink-2)]" aria-hidden />
        <select
          aria-label="Change status"
          className="absolute inset-0 cursor-pointer opacity-0"
          value=""
          disabled={saving}
          onChange={(e) => {
            if (e.target.value) void change(e.target.value as QuoteStatus);
          }}
        >
          <option value="">Choose a status…</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <div className="px-2 pb-2">
          <Notice>{error}</Notice>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- main column

function People({ quote }: { quote: QuoteDto }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
      {/* Internal: which default terms the quote started from. Staff see it
          here only; it's not on the PDF or the client's page. */}
      <CustomerCard doc={quote} aside={`${QUOTE_CLIENT_TYPE_LABELS[quote.clientType]} client`} />
      <EventCard
        doc={quote}
        aside={
          quote.event ? (
            <Link href={`/events/bookings/${quote.event.id}`} className="font-medium text-[var(--accent-ink)] hover:underline">
              Open booking
            </Link>
          ) : quote.eventDeleted ? (
            'Booking deleted'
          ) : null
        }
      />
    </div>
  );
}

function NotesAndTerms({ quote }: { quote: QuoteDto }) {
  return (
    <>
      <NotesAndTermsCards notes={quote.notes} terms={quote.terms} emptyTerms="No terms on this quote." />
      {quote.invoices.length ? (
        <Card>
          <Eyebrow>Invoices</Eyebrow>
          <ul className="space-y-1.5 text-[14px]">
            {quote.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3">
                <Link href={`/invoices/${inv.id}`} className="font-semibold tabular-nums text-[var(--accent-ink)] hover:underline">
                  {inv.invoiceNumber}
                </Link>
                <span className="flex items-center gap-2">
                  <InvoiceStatusBadge status={inv.status} />
                  <PdfActions href={`/api/invoices/${inv.id}/pdf`} compact />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
