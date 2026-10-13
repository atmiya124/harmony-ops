'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Lock, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { ApiError } from '@/lib/apiClient';
import { setQuoteStatus, type QuoteDto } from '@/lib/quotesApi';
import { formatCents } from '@/lib/money';
import { formatBp } from '@/lib/sales/inputs';
import { groupBySection } from '@/lib/sales/quoteDraft';
import { canSetQuoteStatus, isQuoteEditable, MANUAL_QUOTE_STATUSES, QUOTE_STATUS_LABELS, type QuoteStatus } from '@/lib/sales/types';
import { ButtonLink, Card, documentDate, Eyebrow, InvoiceStatusBadge, inputClass, Notice, PdfActions, QuoteStatusBadge } from './ui';

// Read-only view of a saved quote, in the same order as the printed
// document: who it's for, the event, the quote details, the grouped items,
// totals, then notes and terms.
export default function QuoteDetail({ quote, onChange }: { quote: QuoteDto; onChange: (q: QuoteDto) => void }) {
  const editable = isQuoteEditable(quote.status);
  const groups = groupBySection(quote.items);
  const terms = (quote.terms ?? '').split('\n').map((t) => t.trim()).filter(Boolean);

  return (
    <div className="space-y-4 pb-6">
      {/* Header: number, customer, status and the headline total. */}
      <Card className="md:flex md:items-center md:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold tabular-nums text-[var(--ink-2)]">Quote {quote.quoteNumber}</span>
            <QuoteStatusBadge status={quote.status} />
          </div>
          <p className="mt-1.5 truncate text-[24px] font-bold leading-tight tracking-tight">{quote.customerName}</p>
          {quote.customerCompany ? <p className="text-[14px] text-[var(--ink-2)]">{quote.customerCompany}</p> : null}
        </div>
        <div className="mt-4 flex items-stretch overflow-hidden rounded-lg md:mt-0 md:min-w-[260px]">
          <span className="w-1 bg-[var(--accent)]" aria-hidden />
          <div className="flex flex-1 items-center justify-between gap-4 bg-[var(--ink)] px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">Total estimate</span>
            <span className="text-[22px] font-semibold tabular-nums text-white">{formatCents(quote.totalCents)}</span>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {editable ? (
          <ButtonLink href={`/quotes/${quote.id}/edit`}>
            <Pencil size={15} /> Edit quote
          </ButtonLink>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-3)]">
            <Lock size={14} /> {QUOTE_STATUS_LABELS[quote.status]} quotes are locked
          </span>
        )}
        <PdfActions href={`/api/quotes/${quote.id}/pdf`} />
        <StatusControl quote={quote} onChange={onChange} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <Eyebrow>Customer</Eyebrow>
          <p className="text-[15px] font-semibold">{quote.customerName}</p>
          {quote.customerCompany ? <p className="text-[14px] text-[var(--ink-2)]">{quote.customerCompany}</p> : null}
          <div className="mt-2 space-y-1 text-[14px] text-[var(--ink-2)]">
            {quote.billingAddress ? <p className="whitespace-pre-line">{quote.billingAddress}</p> : null}
            {quote.customerEmail ? (
              <a href={`mailto:${quote.customerEmail}`} className="flex items-center gap-1.5 text-[var(--accent-ink)] hover:underline">
                <Mail size={14} /> {quote.customerEmail}
              </a>
            ) : null}
            {quote.customerPhone ? (
              <a href={`tel:${quote.customerPhone}`} className="flex items-center gap-1.5 hover:underline">
                <Phone size={14} /> {quote.customerPhone}
              </a>
            ) : null}
            {!quote.billingAddress && !quote.customerEmail && !quote.customerPhone ? <p className="text-[var(--ink-3)]">No contact details</p> : null}
          </div>
        </Card>

        <Card>
          <Eyebrow
            aside={
              quote.event ? (
                <Link href={`/events/bookings/${quote.event.id}`} className="font-medium text-[var(--accent-ink)] hover:underline">
                  Open booking
                </Link>
              ) : quote.eventDeleted ? (
                'Booking deleted'
              ) : null
            }
          >
            Event
          </Eyebrow>
          <p className="text-[15px] font-semibold">{quote.eventName || 'No event name'}</p>
          <div className="mt-2 space-y-1 text-[14px] text-[var(--ink-2)]">
            <p className="flex items-center gap-1.5">
              <CalendarDays size={14} /> {documentDate(quote.eventDate)}
            </p>
            {quote.venueName || quote.venueAddress ? (
              <p className="flex items-start gap-1.5">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                <span>{[quote.venueName, quote.venueAddress].filter(Boolean).join(', ')}</span>
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <Eyebrow>Quote details</Eyebrow>
          <dl className="space-y-1.5 text-[14px]">
            <Meta label="Quote №" value={quote.quoteNumber} />
            <Meta label="Quote date" value={documentDate(quote.quoteDate)} />
            <Meta label="Valid until" value={documentDate(quote.validUntil)} />
            <Meta label="Deposit" value={quote.depositType === 'none' ? 'None' : formatCents(quote.depositRequiredCents)} />
            <Meta label="Payment on PDF" value={quote.showPaymentDetails ? 'Shown' : 'Hidden'} />
            <Meta label="Created by" value={quote.createdByEmail} />
          </dl>
        </Card>
      </div>

      {/* Grouped items, as on the printed quote. */}
      <Card padded={false} className="overflow-hidden">
        <div className="px-4 pt-4 md:px-5">
          <Eyebrow aside={`${quote.items.length} item${quote.items.length === 1 ? '' : 's'}`}>Items</Eyebrow>
        </div>
        <div className="hidden grid-cols-[minmax(0,1fr)_80px_120px_120px] gap-3 border-y border-[var(--line)] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)] md:grid">
          <span>Item description</span>
          <span className="text-center">Quantity</span>
          <span className="text-right">Unit price</span>
          <span className="text-right">Total</span>
        </div>
        {groups.map((group, g) => (
          <div key={`${group.section}-${g}`}>
            <div className="flex items-center gap-2 border-y border-[var(--line)] bg-[var(--paper-sunk)] px-4 py-2 md:px-5">
              <span className="h-3.5 w-1 rounded-full bg-[var(--accent)]" aria-hidden />
              <span className="text-[12px] font-bold uppercase tracking-[0.06em]">{group.section}</span>
            </div>
            <ul className="divide-y divide-[var(--line)]">
              {group.items.map((item) => (
                <li key={item.id} className="px-4 py-3 md:grid md:grid-cols-[minmax(0,1fr)_80px_120px_120px] md:items-center md:gap-3 md:px-5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold uppercase tracking-[0.02em]">{item.itemName}</p>
                    {item.description ? <p className="mt-0.5 text-[13px] text-[var(--ink-3)]">{item.description}</p> : null}
                    {item.discountCents > 0 ? (
                      <p className="mt-0.5 text-[12px] font-medium text-[var(--bad)]">
                        Discount{item.discountType === 'percent' ? ` ${formatBp(item.discountValue)}` : ''} −{formatCents(item.discountCents)}
                      </p>
                    ) : null}
                  </div>
                  {/* Phone: one line of qty × price = total. */}
                  <p className="mt-1 flex justify-between text-[13px] text-[var(--ink-2)] md:hidden">
                    <span className="tabular-nums">
                      {item.quantity} × {formatCents(item.unitPriceCents)}
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--ink)]">
                      {item.discountCents > 0 ? <span className="mr-1.5 font-normal text-[var(--ink-3)] line-through">{formatCents(item.lineTotalCents)}</span> : null}
                      {formatCents(item.netTotalCents)}
                    </span>
                  </p>
                  <span className="hidden text-center tabular-nums text-[var(--ink-2)] md:block">{item.quantity}</span>
                  <span className="hidden text-right tabular-nums text-[var(--ink-3)] md:block">{formatCents(item.unitPriceCents)}</span>
                  <span className="hidden text-right font-semibold tabular-nums md:block">
                    {formatCents(item.netTotalCents)}
                    {item.discountCents > 0 ? <span className="block text-[12px] font-normal text-[var(--ink-3)] line-through">{formatCents(item.lineTotalCents)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
        <div className="space-y-4">
          {quote.notes ? (
            <Card>
              <Eyebrow>Notes</Eyebrow>
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-[var(--ink-2)]">{quote.notes}</p>
            </Card>
          ) : null}
          <Card>
            <Eyebrow>Terms &amp; conditions</Eyebrow>
            {terms.length ? (
              <ul className="divide-y divide-[var(--line)] text-[14px] text-[var(--ink-2)]">
                {terms.map((t, i) => (
                  <li key={i} className="py-2 first:pt-0 last:pb-0">
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-[var(--ink-3)]">No terms on this quote.</p>
            )}
          </Card>
          {quote.invoices.length ? (
            <Card>
              <Eyebrow>Invoices</Eyebrow>
              <ul className="space-y-1.5 text-[14px]">
                {quote.invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between">
                    <span className="font-semibold tabular-nums">{inv.invoiceNumber}</span>
                    <InvoiceStatusBadge status={inv.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* First on phones (right after the items), beside the notes and terms on wider screens. */}
        <Card className="order-first md:order-none">
          <Eyebrow>Totals</Eyebrow>
          <dl className="space-y-2 text-[14px]">
            {quote.itemDiscountsCents > 0 ? (
              <>
                <Total label="Items" value={formatCents(quote.subtotalCents + quote.itemDiscountsCents)} />
                <Total label="Item discounts" value={`−${formatCents(quote.itemDiscountsCents)}`} tone="text-[var(--bad)]" />
              </>
            ) : null}
            <Total label="Sub total" value={formatCents(quote.subtotalCents)} />
            {quote.discountType !== 'none' ? (
              <Total
                label={`Discount${quote.discountType === 'percent' ? ` ${formatBp(quote.discountValue)}` : ''}`}
                value={`−${formatCents(quote.discountCents)}`}
                tone="text-[var(--bad)]"
              />
            ) : null}
            <Total label={`${quote.taxLabel} ${formatBp(quote.taxRateBp)}`} value={formatCents(quote.taxCents)} />
            <div className="flex items-baseline justify-between border-t border-[var(--line)] pt-3">
              <dt className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--accent-ink)]">Total estimate</dt>
              <dd className="text-[24px] font-bold tabular-nums text-[var(--accent-ink)]">{formatCents(quote.totalCents)}</dd>
            </div>
            {quote.depositType !== 'none' ? (
              <Total
                label={`Deposit required${quote.depositType === 'percent' ? ` (${formatBp(quote.depositValue)})` : ''}`}
                value={formatCents(quote.depositRequiredCents)}
                tone="text-[var(--ok)]"
              />
            ) : null}
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--ink-3)]">{label}</dt>
      <dd className="truncate text-right tabular-nums">{value}</dd>
    </div>
  );
}

function Total({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`flex items-baseline justify-between ${tone}`}>
      <dt className={tone ? '' : 'text-[var(--ink-2)]'}>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// Manual status changes for Phase 1 (no sending or client links yet).
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
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <label htmlFor="quote-status" className="whitespace-nowrap text-[13px] text-[var(--ink-2)]">
        Mark as
      </label>
      <span className="w-36">
        <select
          id="quote-status"
          className={`${inputClass} py-1.5`}
          value=""
          disabled={saving}
          onChange={(e) => {
            if (e.target.value) void change(e.target.value as QuoteStatus);
          }}
        >
          <option value="">{saving ? 'Saving…' : 'Choose…'}</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </span>
      {error ? (
        <div className="basis-full">
          <Notice>{error}</Notice>
        </div>
      ) : null}
    </div>
  );
}
