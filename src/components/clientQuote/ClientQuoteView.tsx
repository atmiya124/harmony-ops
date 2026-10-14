import { AlertCircle, CalendarDays, CheckCircle2, Download, MapPin, XCircle } from 'lucide-react';
import type { PublicQuote, PublicQuoteItem } from '@/lib/sales/publicQuote';
import { formatCents } from '@/lib/money';
import { documentDate } from '@/lib/sales/format';
import { DOCUMENT_CONFIG } from '@/lib/sales/documentConfig';
import ClientQuoteActions from './ClientQuoteActions';

// The client's view of their quote (/q/<token>): Harmony branding, the
// quote as it will be printed, and — while it's open — Accept / Decline.
// Rendered on the server from the whitelisted PublicQuote only.

const company = DOCUMENT_CONFIG;

// "October 13, 2026" for confirmations.
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Toronto' });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-2)] before:mb-1.5 before:block before:h-[3px] before:w-5 before:rounded-full before:bg-[var(--accent)]">
      {children}
    </h2>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 md:p-5 ${className}`}>{children}</section>;
}

export function ClientQuoteHeader({ quote }: { quote?: Pick<PublicQuote, 'quoteNumber' | 'quoteDate' | 'validUntil'> }) {
  const contact = [company.phones[0], company.email, company.website].filter(Boolean);
  return (
    <header className="flex flex-col gap-5 border-b-2 border-[var(--accent)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size brand image served from /public */}
        <img src="/brand/harmony-logo.png" alt={company.companyName} width={220} height={39} className="h-auto w-[200px] sm:w-[220px]" />
        {contact.length ? <p className="mt-3 text-[13px] text-[var(--ink-2)]">{contact.join('  ·  ')}</p> : null}
      </div>
      {quote ? (
        <div className="sm:text-right">
          <p className="text-[34px] font-bold leading-none tracking-tight">Quote</p>
          <p className="mt-2 text-[15px] font-semibold tabular-nums">{quote.quoteNumber}</p>
          <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
            Issued {documentDate(quote.quoteDate)} · Valid until {documentDate(quote.validUntil)}
          </p>
        </div>
      ) : null}
    </header>
  );
}

// A status banner — icon and words, not colour alone.
function StateBanner({ quote }: { quote: PublicQuote }) {
  const r = quote.response;
  if (quote.state === 'accepted') {
    return (
      <div role="status" className="flex gap-3 rounded-xl border border-[var(--ok)]/30 bg-[var(--ok-soft)] p-4 text-[var(--ok)]">
        <CheckCircle2 className="mt-0.5 shrink-0" size={22} aria-hidden />
        <div>
          <p className="text-[17px] font-semibold">Quote accepted</p>
          <p className="mt-0.5 text-[15px] text-[var(--ink)]">Thank you for confirming your quote with {company.companyName}. Our team will contact you with the next steps.</p>
          {r?.action === 'accepted' ? (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-[14px] text-[var(--ink-2)]">
              <dt>Accepted by</dt>
              <dd className="font-medium text-[var(--ink)]">
                {r.name}
                {r.title ? `, ${r.title}` : ''}
              </dd>
              <dt>Accepted on</dt>
              <dd className="font-medium text-[var(--ink)]">{longDate(r.at)}</dd>
            </dl>
          ) : null}
        </div>
      </div>
    );
  }
  if (quote.state === 'declined') {
    return (
      <div role="status" className="flex gap-3 rounded-xl border border-[var(--line-strong)] bg-[var(--paper-sunk)] p-4">
        <XCircle className="mt-0.5 shrink-0 text-[var(--ink-2)]" size={22} aria-hidden />
        <div>
          <p className="text-[17px] font-semibold">Quote declined</p>
          <p className="mt-0.5 text-[15px] text-[var(--ink-2)]">
            {r?.action === 'declined' ? `Declined on ${longDate(r.at)}. ` : ''}Thank you for letting us know. If anything changes, {company.companyName} would be happy to prepare a new quote.
          </p>
        </div>
      </div>
    );
  }
  if (quote.state === 'expired') {
    return (
      <div role="status" className="flex gap-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-4">
        <AlertCircle className="mt-0.5 shrink-0 text-[var(--accent-ink)]" size={22} aria-hidden />
        <div>
          <p className="text-[17px] font-semibold">This quote has expired.</p>
          <p className="mt-0.5 text-[15px] text-[var(--ink-2)]">Please contact {company.companyName} for an updated quote.</p>
        </div>
      </div>
    );
  }
  return null;
}

function ItemRow({ item }: { item: PublicQuoteItem }) {
  const discounted = item.discountCents > 0;
  return (
    <li className="py-3 md:grid md:grid-cols-[minmax(0,1fr)_70px_120px_120px] md:items-center md:gap-3">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{item.name}</p>
        {item.description ? <p className="mt-0.5 text-[14px] text-[var(--ink-2)]">{item.description}</p> : null}
        {discounted ? (
          <p className="mt-0.5 text-[13px] font-medium text-[var(--bad)]">
            Discount{item.discountLabel ? ` ${item.discountLabel}` : ''} −{formatCents(item.discountCents)}
          </p>
        ) : null}
      </div>
      {/* Phone: one line of quantity × price = total. */}
      <p className="mt-1.5 flex items-baseline justify-between text-[14px] text-[var(--ink-2)] md:hidden">
        <span className="tabular-nums">
          {item.quantity} × {formatCents(item.unitPriceCents)}
        </span>
        <span className="text-[15px] font-semibold tabular-nums text-[var(--ink)]">
          {discounted ? <s className="mr-1.5 font-normal text-[var(--ink-3)]">{formatCents(item.lineTotalCents)}</s> : null}
          {formatCents(item.netTotalCents)}
        </span>
      </p>
      <span className="hidden text-center tabular-nums text-[var(--ink-2)] md:block">{item.quantity}</span>
      <span className="hidden text-right tabular-nums text-[var(--ink-2)] md:block">{formatCents(item.unitPriceCents)}</span>
      <span className="hidden text-right font-semibold tabular-nums md:block">
        {formatCents(item.netTotalCents)}
        {discounted ? <s className="block text-[12px] font-normal text-[var(--ink-3)]">{formatCents(item.lineTotalCents)}</s> : null}
      </span>
    </li>
  );
}

function TotalRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${tone ?? ''}`}>
      <dt className={tone ? '' : 'text-[var(--ink-2)]'}>{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export default function ClientQuoteView({ quote, token }: { quote: PublicQuote; token: string }) {
  const t = quote.totals;
  const c = quote.customer;
  return (
    <div className="space-y-5">
      <ClientQuoteHeader quote={quote} />
      <StateBanner quote={quote} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <Eyebrow>Prepared for</Eyebrow>
          <p className="text-[17px] font-semibold">{c.name}</p>
          {c.company ? <p className="text-[15px] text-[var(--ink-2)]">{c.company}</p> : null}
          <div className="mt-2 space-y-0.5 text-[14px] text-[var(--ink-2)]">
            {c.addressLines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            {c.email ? <p className="break-all">{c.email}</p> : null}
            {c.phone ? <p>{c.phone}</p> : null}
          </div>
        </Card>
        {quote.event ? (
          <Card>
            <Eyebrow>Event</Eyebrow>
            {quote.event.name ? <p className="text-[17px] font-semibold">{quote.event.name}</p> : null}
            <div className="mt-2 space-y-1.5 text-[14px] text-[var(--ink-2)]">
              <p className="flex items-center gap-2">
                <CalendarDays size={16} aria-hidden /> <span className="sr-only">Date:</span> {documentDate(quote.event.date)}
              </p>
              {quote.event.venue ? (
                <p className="flex items-start gap-2">
                  <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden /> <span className="sr-only">Venue:</span> <span>{quote.event.venue}</span>
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="px-4 pt-4 md:px-5">
          <Eyebrow>What’s included</Eyebrow>
        </div>
        {/* Column headings: plain, with a firm underline — distinct from the
            grey section bands below them. */}
        <div className="hidden grid-cols-[minmax(0,1fr)_70px_120px_120px] gap-3 border-b-2 border-[var(--line-strong)] px-5 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)] md:grid" aria-hidden>
          <span>Item</span>
          <span className="text-center">Qty</span>
          <span className="text-right">Unit price</span>
          <span className="text-right">Total</span>
        </div>
        {quote.sections.map((s, i) => (
          <div key={i}>
            <h3 className="flex items-center gap-2 border-y border-[var(--line)] bg-[var(--paper-sunk)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.06em] md:px-5">
              <span className="h-3.5 w-1 rounded-full bg-[var(--accent)]" aria-hidden />
              {s.name}
            </h3>
            <ul className="divide-y divide-[var(--line)] px-4 md:px-5">
              {s.items.map((item, j) => (
                <ItemRow key={j} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <Card className="md:ml-auto md:w-[380px]">
        <Eyebrow>Totals</Eyebrow>
        <dl className="space-y-2 text-[15px]">
          {t.itemDiscountsCents > 0 ? (
            <>
              <TotalRow label="Items" value={formatCents(t.subtotalCents + t.itemDiscountsCents)} />
              <TotalRow label="Item discounts" value={`−${formatCents(t.itemDiscountsCents)}`} tone="text-[var(--bad)]" />
            </>
          ) : null}
          <TotalRow label="Subtotal" value={formatCents(t.subtotalCents)} />
          {t.discountLabel ? <TotalRow label={t.discountLabel} value={`−${formatCents(t.discountCents)}`} tone="text-[var(--bad)]" /> : null}
          {t.taxLabel ? <TotalRow label={t.taxLabel} value={formatCents(t.taxCents)} /> : null}
          <div className="flex items-baseline justify-between gap-4 border-t border-[var(--line)] pt-3">
            <dt className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--accent-ink)]">Total estimate</dt>
            <dd className="text-[26px] font-bold tabular-nums text-[var(--accent-ink)]">{formatCents(t.totalCents)}</dd>
          </div>
          {t.depositLabel ? <TotalRow label={t.depositLabel} value={formatCents(t.depositRequiredCents)} tone="text-[var(--ok)]" /> : null}
        </dl>
      </Card>

      {quote.notes ? (
        <Card>
          <Eyebrow>Notes</Eyebrow>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--ink-2)]">{quote.notes}</p>
        </Card>
      ) : null}

      {quote.terms.length ? (
        <Card>
          <Eyebrow>Terms &amp; conditions</Eyebrow>
          <ul className="divide-y divide-[var(--line)] text-[14px] leading-relaxed text-[var(--ink-2)]">
            {quote.terms.map((term, i) => (
              <li key={i} className="py-2 first:pt-0 last:pb-0">
                {term}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {quote.state === 'open' ? <ClientQuoteActions token={token} version={quote.version} /> : null}

      <div className="flex flex-col items-center gap-3 border-t border-[var(--line)] pt-5 text-center">
        <a
          href={`/api/public/quotes/${encodeURIComponent(token)}/pdf?download=1`}
          className="inline-flex touch-manipulation items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--paper)] px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-2)] transition-transform duration-75 hover:bg-[var(--paper-sunk)] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
        >
          <Download size={16} aria-hidden /> Download PDF
        </a>
        <ClientQuoteFooter />
      </div>
    </div>
  );
}

export function ClientQuoteFooter() {
  return (
    <footer className="text-[12px] text-[var(--ink-3)]">
      <p className="font-semibold text-[var(--ink-2)]">{company.companyName}</p>
      {company.addressLines.length ? <p>{company.addressLines.join(', ')}</p> : null}
      <p>{[...company.phones, company.email, company.website].filter(Boolean).join('  ·  ')}</p>
    </footer>
  );
}
