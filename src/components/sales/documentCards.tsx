// Read-only blocks shared by Quote Details and Invoice Details: the grouped
// items, customer, event, notes and terms, laid out as on the printed
// document. Each takes only the fields it shows.

import { CalendarDays, Mail, MapPin, Phone } from 'lucide-react';
import { formatCents } from '@/lib/money';
import { formatBp } from '@/lib/sales/inputs';
import { groupBySection } from '@/lib/sales/quoteDraft';
import type { QuoteItemDto } from '@/lib/quotesApi';
import { Card, documentDate, Eyebrow } from './ui';

// A label and figure in a totals or details list.
export function SummaryRow({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${tone}`}>
      <dt className={tone ? '' : 'text-[var(--ink-2)]'}>{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// Grouped items, as on the printed document.
export function ItemsCard({ items }: { items: QuoteItemDto[] }) {
  const groups = groupBySection(items);
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 md:px-5">
        <h2 className="text-[15px] font-semibold">Items</h2>
        <span className="text-[13px] text-[var(--ink-3)]">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_72px_110px_110px] gap-3 bg-[var(--ink)] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white md:grid">
        <span>Item description</span>
        <span className="text-center">Quantity</span>
        <span className="text-right">Unit price</span>
        <span className="text-right">Total</span>
      </div>
      {groups.map((group, g) => (
        <div key={`${group.section}-${g}`}>
          <div className="flex items-center gap-2 border-y border-[var(--line-strong)] bg-[#e8e9ec] px-4 py-2 md:px-5">
            <span className="h-3.5 w-1 rounded-full bg-[var(--accent)]" aria-hidden />
            <span className="text-[12px] font-bold uppercase tracking-[0.06em]">{group.section}</span>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {group.items.map((item) => (
              <li key={item.id} className="px-4 py-3.5 md:grid md:grid-cols-[minmax(0,1fr)_72px_110px_110px] md:items-center md:gap-3 md:px-5">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold uppercase tracking-[0.02em]">{item.itemName}</p>
                  {item.description ? <p className="mt-0.5 text-[13px] text-[var(--ink-3)]">{item.description}</p> : null}
                  {item.discountCents > 0 ? (
                    <p className="mt-0.5 text-[12px] font-medium text-[var(--bad)]">
                      Discount
                      {item.discountType === 'percent' ? ` ${formatBp(item.discountValue)}` : ''} −{formatCents(item.discountCents)}
                    </p>
                  ) : null}
                </div>
                {/* Phone: one line of qty × price = total, on a faint tint so
                    the figures stand apart from the description. */}
                <p className="mt-2 flex items-baseline justify-between gap-3 rounded-lg bg-[var(--paper-sunk)] px-3 py-2 text-[13px] text-[var(--ink-2)] md:hidden">
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
  );
}

export interface CustomerFields {
  customerName: string;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  billingAddress: string | null;
}

export function CustomerCard({ doc, heading = 'Customer', aside }: { doc: CustomerFields; heading?: string; aside?: React.ReactNode }) {
  return (
    <Card>
      <Eyebrow aside={aside}>{heading}</Eyebrow>
      <p className="text-[15px] font-semibold">{doc.customerName}</p>
      {doc.customerCompany ? <p className="text-[14px] text-[var(--ink-2)]">{doc.customerCompany}</p> : null}
      <div className="mt-2 space-y-1 text-[14px] text-[var(--ink-2)]">
        {doc.billingAddress ? <p className="whitespace-pre-line">{doc.billingAddress}</p> : null}
        {doc.customerEmail ? (
          <a href={`mailto:${doc.customerEmail}`} className="flex items-start gap-1.5 text-[var(--accent-ink)] hover:underline">
            <Mail size={14} className="mt-[3px] shrink-0" /> <span className="min-w-0 break-all">{doc.customerEmail}</span>
          </a>
        ) : null}
        {doc.customerPhone ? (
          <a href={`tel:${doc.customerPhone}`} className="flex items-center gap-1.5 hover:underline">
            <Phone size={14} /> {doc.customerPhone}
          </a>
        ) : null}
        {!doc.billingAddress && !doc.customerEmail && !doc.customerPhone ? <p className="text-[var(--ink-3)]">No contact details</p> : null}
      </div>
    </Card>
  );
}

export function EventCard({
  doc,
  aside,
}: {
  doc: {
    eventName: string | null;
    eventDate: string | null;
    venueName: string | null;
    venueAddress: string | null;
  };
  aside?: React.ReactNode;
}) {
  return (
    <Card>
      <Eyebrow aside={aside}>Event</Eyebrow>
      <p className="text-[15px] font-semibold">{doc.eventName || 'No event name'}</p>
      <div className="mt-2 space-y-1 text-[14px] text-[var(--ink-2)]">
        <p className="flex items-center gap-1.5">
          <CalendarDays size={14} /> {documentDate(doc.eventDate)}
        </p>
        {doc.venueName || doc.venueAddress ? (
          <p className="flex items-start gap-1.5">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            <span>{[doc.venueName, doc.venueAddress].filter(Boolean).join(', ')}</span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}

// Notes (when there are any), then the terms one per line.
export function NotesAndTermsCards({ notes, terms, emptyTerms }: { notes: string | null; terms: string | null; emptyTerms: string }) {
  const lines = (terms ?? '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
  return (
    <>
      {notes ? (
        <Card>
          <Eyebrow>Notes</Eyebrow>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-[var(--ink-2)]">{notes}</p>
        </Card>
      ) : null}
      <Card>
        <Eyebrow>Terms &amp; conditions</Eyebrow>
        {lines.length ? (
          <ul className="divide-y divide-[var(--line)] text-[14px] text-[var(--ink-2)]">
            {lines.map((t, i) => (
              <li key={i} className="py-2 first:pt-0 last:pb-0">
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-[var(--ink-3)]">{emptyTerms}</p>
        )}
      </Card>
    </>
  );
}
