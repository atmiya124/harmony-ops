/** @jsxImportSource @/lib/documents/html */
// These <img> tags are PDF markup (embedded data URIs), never a Next.js page,
// so next/image doesn't apply.
/* eslint-disable @next/next/no-img-element */
// The building blocks of the quote and invoice PDFs, shared by both. Written
// in JSX but rendered by a small HTML-string runtime (lib/documents/html),
// not React, to static HTML on the server (renderDocument.tsx), and laid out
// into A4 pages by the layout script — never shipped to the browser. Every
// value comes from the DocumentModel and is escaped by React.
//
// Each block that the layout script places is marked with data-flow:
//   section | item         item table rows (a section header is kept with
//                          its first item; items carry their section name
//                          so a page break can repeat "SECTION (CONTINUED)")
//   block                  kept whole (totals, acceptance, payment status)
//   band-head              a heading kept with the block that follows it
//   term                   one term (terms may run onto a new page)

import type { DocumentModel, DocumentItem, DocumentTotalRow, SignedAcceptance, StatusStep } from '@/lib/documents/documentModel';
import { HARMONY_LOGO_PNG, HARMONY_LOGO_RATIO, HARMONY_MARK_PNG, HARMONY_MARK_RATIO } from '@/lib/documents/logos.generated';
import { PAID_STAMP_SVG } from '@/lib/documents/paidStamp';

const ACCENT = '#f08a1d';

// The Harmony Production logo (embedded PNGs with transparent backgrounds,
// so the header stripes show through). `HarmonyMark` is the HP symbol alone.
export function HarmonyLogo({ width }: { width: number }) {
  return <img className="logo" src={HARMONY_LOGO_PNG} width={width} height={Math.round(width / HARMONY_LOGO_RATIO)} alt="Harmony Production" />;
}

export function HarmonyMark({ width }: { width: number }) {
  return <img className="logo" src={HARMONY_MARK_PNG} width={width} height={Math.round(width / HARMONY_MARK_RATIO)} alt="" />;
}

// ---------------------------------------------------------------- header

export function DocumentHeader({ doc }: { doc: DocumentModel }) {
  const c = doc.company;
  return (
    // A grid: the orange rule on its own row, then the logo, contact details
    // and title side by side on one row, all centred on the same line.
    <div className="head-top">
      <div className="head-rule" />
      <div className="brand">
        <HarmonyLogo width={270} />
      </div>
      <div className="company-contact">
        {c.addressLines.length ? <p>{c.addressLines.join(', ')}</p> : null}
        {c.phones.length ? <p>{c.phones.join(' // ')}</p> : null}
        {c.businessHours ? <p className="muted">{c.businessHours}</p> : null}
        {c.email ? <p>{c.email}</p> : null}
        {c.website ? <p>{c.website}</p> : null}
      </div>
      <DocumentIdentity doc={doc} />
    </div>
  );
}

export function DocumentIdentity({ doc }: { doc: DocumentModel }) {
  return (
    <div className="doc-title">
      <h1>{doc.title}</h1>
      <div className="subtitle">{doc.subtitle}</div>
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="8" fill="#2d2d33" />
      <circle cx="8" cy="6.2" r="2.6" fill="#fff" />
      <path d="M3.4 13.2c.9-2.1 2.6-3.2 4.6-3.2s3.7 1.1 4.6 3.2A6.9 6.9 0 0 1 8 15a6.9 6.9 0 0 1-4.6-1.8z" fill="#fff" />
    </svg>
  );
}

export function CustomerBlock({ doc }: { doc: DocumentModel }) {
  const c = doc.customer;
  return (
    <div className="party customer-block">
      <div className="eyebrow">{c.heading}</div>
      <div className="customer-name">
        <PersonIcon />
        <span>{c.name}</span>
      </div>
      {c.company ? <div className="customer-company">{c.company}</div> : null}
      {c.addressLines.length ? (
        <div className="customer-lines">
          {c.addressLines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      ) : null}
      {c.email ? <div className="customer-row email">{c.email}</div> : null}
      {c.phone ? <div className="customer-row phone">{c.phone}</div> : null}
      <EventBlock doc={doc} />
    </div>
  );
}

// The event, at the foot of the customer column — level with the total
// banner opposite, in the space below the client's details.
export function EventBlock({ doc }: { doc: DocumentModel }) {
  if (doc.event.length === 0) return null;
  return (
    <div className="event-block">
      <div className="event-title">Event details</div>
      {doc.event.map((e) => (
        <div className="meta-row" key={e.label}>
          <span className="meta-label">{e.label}</span>
          <span className="meta-colon">:</span>
          <span className="event-value">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DocumentMeta({ doc }: { doc: DocumentModel }) {
  return (
    <div className="party">
      <div className="eyebrow">{doc.metaHeading}</div>
      <div className="meta">
        {doc.meta.map((m) => (
          <div className="meta-row" key={m.label}>
            <span className="meta-label">{m.label}</span>
            <span className="meta-colon">:</span>
            <span className={`meta-value${m.strong ? ' strong' : ''}`}>{m.value}</span>
          </div>
        ))}
      </div>
      <DocumentTotalBanner doc={doc} />
    </div>
  );
}

export function DocumentTotalBanner({ doc }: { doc: DocumentModel }) {
  return (
    <div className="banner">
      <span className="banner-label">{doc.banner.label} :</span>
      <span className="banner-value">{doc.banner.value}</span>
    </div>
  );
}

// Page 1: full header, who it's for, the document details and total.
export function FirstPageHead({ doc }: { doc: DocumentModel }) {
  return (
    <header className="page-head" data-part="first-head">
      <DocumentHeader doc={doc} />
      <div className="parties">
        <CustomerBlock doc={doc} />
        <DocumentMeta doc={doc} />
      </div>
      <div className="parties-end" />
    </header>
  );
}

// Page 2 onwards: logo, and which document this page belongs to.
export function ContinuationHead({ doc }: { doc: DocumentModel }) {
  return (
    <header className="cont-head" data-part="cont-head">
      <HarmonyLogo width={184} />
      <div className="cont-right">
        <div className="doc-ref">{doc.continuation.left}</div>
        <div className="doc-sub">{doc.continuation.right}</div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- items

export function ItemTableHead() {
  return (
    <div className="cols table-head" data-part="table-head">
      <span>Item description</span>
      <span className="qty">Quantity</span>
      <span className="num">Unit price</span>
      <span className="num">Total</span>
    </div>
  );
}

export function ItemSectionHeader({ name, continued = false }: { name: string; continued?: boolean }) {
  return (
    <div className="section-row" data-flow="section" data-section={name}>
      <span className="section-name">{name}</span>
      {continued ? <span> (continued)</span> : null}
    </div>
  );
}

function Bullet() {
  return (
    <svg className="item-bullet" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <circle cx="6" cy="6" r="6" fill={ACCENT} />
      <path d="M3.4 6h4.6M6.2 3.9 8.3 6 6.2 8.1" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ItemRow({ item, section }: { item: DocumentItem; section: string }) {
  return (
    <div className="cols item" data-flow="item" data-section={section}>
      <div className="item-main">
        <Bullet />
        <div style={{ minWidth: 0 }}>
          <div className="item-name">{item.name}</div>
          {item.description ? <div className="item-desc">{item.description}</div> : null}
          {item.discountNote ? <div className="item-discount">{item.discountNote}</div> : null}
        </div>
      </div>
      <span className="qty">{item.quantity}</span>
      <span className="num unit">{item.unitPrice}</span>
      <span className="num total">
        {item.originalTotal ? <s>{item.originalTotal}</s> : null}
        {item.total}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- totals & payment

function TotalLine({ row }: { row: DocumentTotalRow }) {
  return (
    <div className={`total-row ${row.tone}${row.strong ? ' strong' : ''}`}>
      <span className="k">{row.label}</span>
      <span className="colon">:</span>
      <span className="v">{row.value}</span>
    </div>
  );
}

export function TotalsBlock({ doc }: { doc: DocumentModel }) {
  return (
    <div className="totals">
      {doc.totals.map((r) => (
        <TotalLine key={r.label} row={r} />
      ))}
      <div className="grand">
        <span className="k">{doc.grandTotal.label} :</span>
        <span className="v">{doc.grandTotal.value}</span>
      </div>
      {doc.afterGrandTotal.length ? (
        <div className="after-grand">
          {doc.afterGrandTotal.map((r) => (
            <TotalLine key={r.label} row={r} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Left of the totals: how to pay (when the document shows payment details),
// then who to contact with questions and a thank-you.
export function PaymentBlock({ doc }: { doc: DocumentModel }) {
  const p = doc.payment;
  return (
    <div className={`pay${p ? '' : doc.termsPlacement === 'summary' ? ' pay-none with-terms' : ' pay-none'}`}>
      {p ? (
        <>
          <div className="pay-bar">
            <span className="title">{p.title}</span>
            {p.reference ? <span className="ref">{p.reference}</span> : null}
          </div>
          {p.note ? <p className="pay-note">{p.note}</p> : null}
          {p.rows.length ? (
            <div className="pay-rows">
              {p.rows.map((r) => (
                <div className="pay-row" key={r.label}>
                  <span className="k">{r.label}</span>
                  <span className="v">{r.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {!p && doc.termsPlacement === 'summary' ? (
        <div className="pay-terms">
          <p className="q-title">Terms &amp; conditions</p>
          <TermList terms={doc.terms} flow={false} />
        </div>
      ) : (
        <div className="pay-questions">
          <p className="q-title">{doc.questions.title}</p>
          <p>{doc.questions.text}</p>
        </div>
      )}
      <p className="pay-thanks">Thank you for choosing {doc.company.companyName}!</p>
    </div>
  );
}

export function SummaryBlock({ doc }: { doc: DocumentModel }) {
  return (
    <div className="summary" data-flow="block">
      <PaymentBlock doc={doc} />
      <TotalsBlock doc={doc} />
    </div>
  );
}

// ---------------------------------------------------------------- notes & terms

function BandHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="band-head" data-flow="band-head">
      <span className="eyebrow">{title}</span>
      {aside ? <span className="aside">{aside}</span> : null}
    </div>
  );
}

export function NotesBlock({ doc }: { doc: DocumentModel }) {
  if (!doc.notes) return null;
  return (
    <>
      <BandHead title="Notes" />
      <p className="notes-text" data-flow="block">
        {doc.notes}
      </p>
    </>
  );
}

// One term per row, unnumbered. In the full-width section each term is its
// own layout block (so long terms can run onto the next page); beside the
// totals they stay together.
function TermList({ terms, flow }: { terms: string[]; flow: boolean }) {
  return (
    <>
      {terms.map((t, i) => (
        <p className="term" data-flow={flow ? 'term' : undefined} key={i}>
          {t}
        </p>
      ))}
    </>
  );
}

export function TermsBlock({ doc }: { doc: DocumentModel }) {
  if (doc.terms.length === 0 || doc.termsPlacement !== 'section') return null;
  return (
    <>
      <BandHead title="Terms & conditions" aside={doc.termsAside} />
      <TermList terms={doc.terms} flow />
    </>
  );
}

// ---------------------------------------------------------------- acceptance (quote)

function SignLine({ label, value, className = '' }: { label: string; value?: unknown; className?: string }) {
  return (
    <div className={`sign-line ${className}`.trim()}>
      <span>{label}</span>
      <span className="rule">{value ?? null}</span>
    </div>
  );
}

// The client's signature on its line: a drawn one as its image (proportions
// kept), a typed one as their name, marked as typed.
function SignedSignature({ signature }: { signature: SignedAcceptance['signature'] }) {
  if (!signature) return <span className="filled muted">Signature on file unavailable</span>;
  if (signature.kind === 'drawn') return <img className="sig-image" src={signature.image} width={600} height={200} alt="Client signature" />;
  return (
    <span className="filled">
      <span className="sig-typed">{signature.text}</span>
      <span className="muted"> (typed)</span>
    </span>
  );
}

// Blank lines for a wet or scanned signature — or, once the client has
// accepted online, their name, signature, title and the time they accepted.
export function QuoteAcceptance({ doc }: { doc: DocumentModel }) {
  if (!doc.acceptance) return null;
  const signed = doc.acceptance.signed;
  if (signed) return <SignedQuoteAcceptance doc={doc} signed={signed} />;
  return (
    <>
      <BandHead title="Quote acceptance" aside="Sign and return a copy of this quote to confirm your booking" />
      <div className="accept" data-flow="block">
        <div>
          <div className="who">{doc.acceptance.authorizedBy}</div>
          <div className="sign-lines">
            <SignLine label="Signature" />
            <SignLine label="Name" />
            <SignLine label="Date" />
          </div>
        </div>
        <div>
          <div className="who accent">Customer approval:</div>
          <div className="statement">
            <span className="box" />
            <span>{doc.acceptance.customerStatement}</span>
          </div>
          <div className="sign-lines" style={{ marginTop: 10 }}>
            <SignLine label="Signature" />
            <SignLine label="Name" />
            <div className="sign-pair">
              <SignLine label="Date" />
              <SignLine label="Title" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SignedQuoteAcceptance({ doc, signed }: { doc: DocumentModel; signed: SignedAcceptance }) {
  const authorized = doc.acceptance!.authorizedSigned;
  return (
    <>
      <BandHead title="Quote acceptance" aside={`Accepted online · ${signed.acceptedAt}`} />
      <div className="accept signed" data-flow="block">
        <div>
          <div className="who">{doc.acceptance!.authorizedBy}</div>
          <div className="sign-lines">
            <SignLine
              label="Signature"
              className="sig"
              value={authorized ? <span className="filled"><span className="sig-typed">{authorized.name}</span></span> : null}
            />
            <SignLine label="Name" value={authorized ? <span className="filled">{authorized.name}</span> : null} />
            <SignLine label="Date" value={authorized ? <span className="filled">{authorized.date}</span> : null} />
          </div>
        </div>
        <div>
          <div className="who accent">Customer approval:</div>
          <div className="statement">
            <span className="box checked">✓</span>
            <span>{doc.acceptance!.customerStatement}</span>
          </div>
          <div className="sign-lines" style={{ marginTop: 10 }}>
            <SignLine label="Signature" className="sig" value={<SignedSignature signature={signed.signature} />} />
            <SignLine label="Name" value={<span className="filled">{signed.name}</span>} />
            <div className="sign-pair">
              <SignLine label="Date" value={<span className="filled">{signed.date}</span>} />
              <SignLine label="Title" value={signed.title ? <span className="filled">{signed.title}</span> : null} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- payment status (invoice)

function StepDot({ state }: { state: StatusStep['state'] }) {
  return (
    <span className={`dot ${state}`}>
      {state === 'done' ? (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path d="M1.4 4.2 3.2 6 6.6 2.2" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

// The PAID seal (public/icons/paid.svg, inlined), in place of the badge once
// the invoice is paid in full.
function PaidStamp() {
  return <img className="paid-stamp" src={PAID_STAMP_SVG} width="64" height="64" alt="Paid" />;
}

// What the invoice records today: the steps, and Paid / Unpaid / Void.
export function PaymentStatus({ doc }: { doc: DocumentModel }) {
  const s = doc.paymentStatus;
  if (!s) return null;
  return (
    <>
      <BandHead title="Payment status" aside={s.caption ?? undefined} />
      <div className="status" data-flow="block">
        <div className="timeline">
          {s.steps.map((step) => (
            <div className={`step ${step.state}`} key={step.label}>
              <StepDot state={step.state} />
              <div>
                <div className="label">{step.label}</div>
                {step.detail ? <div className="detail">{step.detail}</div> : null}
              </div>
              {step.value ? <span className="value">{step.value}</span> : null}
            </div>
          ))}
        </div>
        <div className="status-side">
          <div className="badge-row">
            {s.badgeTone === 'paid' ? <PaidStamp /> : <span className={`badge ${s.badgeTone}`}>{s.badge}</span>}
            <span className="badge-note">{s.badgeNote}</span>
          </div>
          <div className="authorized">
            <SignLine label="Authorized" />
            <p className="for">For and on behalf of {doc.company.companyName}</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- footer

export function DocumentFooter({ doc }: { doc: DocumentModel }) {
  const c = doc.company;
  return (
    <footer className="page-foot" data-part="footer">
      <div className="foot-note">
        <p>{doc.footerNote}</p>
        <p className="page-no">PAGE 1 OF 1</p>
      </div>
      <div className="foot-mid">
        <p className="services">{c.services.join('  |  ')}</p>
        {c.email ? <p>{c.email}</p> : null}
        {c.website ? <p>{c.website}</p> : null}
      </div>
      <div className="foot-right">
        <div>
          {c.addressLines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          {c.phones[0] ? <p>{c.phones[0]}</p> : null}
          {!c.addressLines.length && !c.phones.length ? <p>{c.companyName}</p> : null}
        </div>
        <HarmonyMark width={46} />
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------- shell

// Everything the layout script needs, in reading order. It copies these into
// as many A4 pages as the content needs (see layoutScript.ts).
export function DocumentShell({ doc }: { doc: DocumentModel }) {
  return (
    <>
      <div id="flow">
        <FirstPageHead doc={doc} />
        <ContinuationHead doc={doc} />
        <ItemTableHead />
        <DocumentFooter doc={doc} />
        <div data-part="content">
          {doc.sections.flatMap((section, s) => [
            <ItemSectionHeader key={`s${s}`} name={section.name} />,
            ...section.items.map((item, i) => <ItemRow key={`s${s}i${i}`} item={item} section={section.name} />),
          ])}
          <div className="items-end" data-flow="items-end" />
          <SummaryBlock doc={doc} />
          <NotesBlock doc={doc} />
          <TermsBlock doc={doc} />
          {doc.kind === 'quote' ? <QuoteAcceptance doc={doc} /> : <PaymentStatus doc={doc} />}
        </div>
      </div>
      <div id="pages" />
    </>
  );
}
