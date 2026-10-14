// Turns a saved quote or invoice into exactly what its PDF prints. Every
// amount is a stored figure from Phase 1 (recalculated by the server when it
// was saved) — nothing is added up or re-derived here, so the PDF can never
// disagree with the app. Missing values are dropped, never replaced with
// placeholder text.

import type { QuoteDto } from '../db/quoteRepo';
import type { InvoiceDto } from '../db/invoiceRepo';
import type { DocumentAcceptance } from '../db/clientLinkRepo';
import { formatCents } from '../money';
import { formatBp } from '../sales/inputs';
import { documentDate, documentDateTime, torontoDate } from '../sales/format';
import { groupBySection } from '../sales/quoteDraft';
import type { DocumentConfig } from '../sales/documentConfig';

export interface DocumentItem {
  name: string;
  description: string | null;
  quantity: string;
  unitPrice: string;
  total: string; // what the line adds to the subtotal
  originalTotal: string | null; // quantity × price, when a line discount applies
  discountNote: string | null; // "Discount 10% −$240.00"
}

export interface DocumentSection {
  name: string;
  items: DocumentItem[];
}

export type TotalTone = 'plain' | 'discount' | 'paid';

export interface DocumentTotalRow {
  label: string;
  value: string;
  tone: TotalTone;
  strong?: boolean; // a closing total, e.g. "INVOICE TOTAL"
}

export interface PaymentRow {
  label: string;
  value: string;
}

export interface StatusStep {
  label: string;
  detail: string | null; // a date
  value: string | null; // an amount or reference
  state: 'done' | 'current' | 'upcoming';
}

export interface SignedAcceptance {
  name: string;
  title: string | null;
  date: string; // "13 Oct, 2026", for the Date line
  acceptedAt: string; // "13 Oct, 2026, 3:05 p.m." (Toronto)
  // A drawn signature is a PNG data URL; null when the stored signature is
  // missing or unreadable (the line is then left with a note).
  signature: { kind: 'drawn'; image: string } | { kind: 'typed'; text: string } | null;
}

export interface DocumentModel {
  kind: 'quote' | 'invoice';
  title: string; // "Quote"
  subtitle: string; // "EVENT PRODUCTION ESTIMATE"
  number: string;
  fileName: string;
  company: DocumentConfig;
  customer: {
    heading: string;
    name: string;
    company: string | null;
    addressLines: string[];
    email: string | null;
    phone: string | null;
  };
  metaHeading: string;
  meta: { label: string; value: string; strong?: boolean }[];
  // The event, printed at the foot of the customer column. Empty = no event
  // details on the quote/invoice, and the block is left out.
  event: { label: string; value: string }[];
  banner: { label: string; value: string };
  sections: DocumentSection[];
  totals: DocumentTotalRow[];
  grandTotal: { label: string; value: string }; // the big orange figure
  afterGrandTotal: DocumentTotalRow[]; // e.g. deposit required
  // Null when the quote/invoice is set not to print payment details.
  payment: {
    title: string;
    reference: string | null;
    rows: PaymentRow[];
    note: string | null;
  } | null;
  questions: { title: string; text: string };
  notes: string | null;
  terms: string[];
  termsAside: string;
  // Where the terms print: their own section after the totals, or — when the
  // payment section is switched off and they're short enough — in its place
  // beside the totals.
  termsPlacement: 'section' | 'summary';
  // Quotes. `signed` is filled in once the client has accepted online.
  acceptance: { authorizedBy: string; customerStatement: string; signed: SignedAcceptance | null } | null;
  paymentStatus: { caption: string | null; steps: StatusStep[]; badge: string; badgeTone: 'due' | 'paid' | 'void'; badgeNote: string } | null; // invoices
  continuation: { left: string; right: string }; // compact header on page 2+
  footerNote: string;
}

const money = formatCents;
const minus = (cents: number) => `−${formatCents(cents)}`;

// "Harmony_Production_Quote_Q-000000001.pdf" — letters, digits, - and _ only.
export function documentFileName(companyName: string, kind: 'Quote' | 'Invoice', number: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${safe(companyName)}_${kind}_${safe(number) || 'Draft'}.pdf`;
}

// Saved terms are free text, one term per line. Lines are kept word for
// word; only blank lines are dropped (numbering is added by the template).
export function splitTerms(terms: string | null): string[] {
  return (terms ?? '')
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// The space beside the totals (no page breaks inside it) holds about this
// much text; longer terms keep their own section, which can run onto the
// next page.
const SUMMARY_TERMS_MAX_LINES = 16;
const SUMMARY_TERMS_CHARS_PER_LINE = 64;

export function termsPlacement(showPaymentDetails: boolean, terms: string[]): DocumentModel['termsPlacement'] {
  if (showPaymentDetails || terms.length === 0) return 'section';
  const estimatedLines = terms.reduce((n, t) => n + Math.ceil(t.length / SUMMARY_TERMS_CHARS_PER_LINE), 0);
  return estimatedLines <= SUMMARY_TERMS_MAX_LINES ? 'summary' : 'section';
}

function lines(text: string | null): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

type SavedItem = QuoteDto['items'][number];

function sectionsOf(items: SavedItem[]): DocumentSection[] {
  return groupBySection(items).map((g) => ({
    name: g.section,
    items: g.items.map((i) => ({
      name: i.itemName,
      description: i.description,
      quantity: String(i.quantity),
      unitPrice: money(i.unitPriceCents),
      total: money(i.netTotalCents),
      originalTotal: i.discountCents > 0 ? money(i.lineTotalCents) : null,
      discountNote: i.discountCents > 0 ? `Discount${i.discountType === 'percent' ? ` ${formatBp(i.discountValue)}` : ''} ${minus(i.discountCents)}` : null,
    })),
  }));
}

// Sub total, discount and tax rows shared by both documents. Item discounts
// are already inside the subtotal; they're itemised so the maths reads.
function chargeRows(d: {
  itemDiscountsCents: number;
  subtotalCents: number;
  discountType: QuoteDto['discountType'];
  discountValue: number;
  discountCents: number;
  taxLabel: string;
  taxRateBp: number;
  taxCents: number;
}): DocumentTotalRow[] {
  const rows: DocumentTotalRow[] = [];
  if (d.itemDiscountsCents > 0) {
    rows.push({ label: 'Items', value: money(d.subtotalCents + d.itemDiscountsCents), tone: 'plain' });
    rows.push({ label: 'Item discounts', value: minus(d.itemDiscountsCents), tone: 'discount' });
  }
  rows.push({ label: 'Sub total', value: money(d.subtotalCents), tone: 'plain' });
  if (d.discountCents > 0) {
    rows.push({ label: `Discount${d.discountType === 'percent' ? ` ${formatBp(d.discountValue)}` : ''}`, value: minus(d.discountCents), tone: 'discount' });
  }
  if (d.taxRateBp > 0 || d.taxCents > 0) rows.push({ label: `${d.taxLabel} ${formatBp(d.taxRateBp)}`, value: money(d.taxCents), tone: 'plain' });
  return rows;
}

// Event name, date and venue. A quote for an event whose date isn't fixed
// yet shows "TBC", as on the reference; with no event details at all the
// block is dropped.
function eventRows(d: { eventName: string | null; eventDate: string | null; venueName: string | null; venueAddress: string | null }) {
  const venue = [d.venueName, d.venueAddress].filter(Boolean).join(', ');
  if (!d.eventName && !d.eventDate && !venue) return [];
  return [
    ...(d.eventName ? [{ label: 'Event', value: d.eventName }] : []),
    { label: 'Event date', value: documentDate(d.eventDate) },
    ...(venue ? [{ label: 'Venue', value: venue }] : []),
  ];
}

function customerOf(heading: string, d: { customerName: string; customerCompany: string | null; billingAddress: string | null; customerEmail: string | null; customerPhone: string | null }) {
  return {
    heading,
    name: d.customerName,
    company: d.customerCompany,
    addressLines: lines(d.billingAddress),
    email: d.customerEmail,
    phone: d.customerPhone,
  };
}

function questionsOf(config: DocumentConfig, kind: string, reference: string | null): { title: string; text: string } {
  const contact = [config.email, config.phones[0]].filter(Boolean).join(' or ');
  const text = contact ? `Contact us at ${contact}.` : `Contact ${config.companyName}.`;
  return { title: `Questions about this ${kind}?`, text: reference ? `${text} Please quote the reference number ${reference}.` : text };
}

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

// The client's online acceptance, printed only while it still describes
// this quote: the quote is accepted (or converted) and its total is the one
// the client agreed to. A quote that was reopened, edited and re-marked
// accepted by staff prints blank signature lines again.
export function signedAcceptance(q: QuoteDto, a: DocumentAcceptance | null): SignedAcceptance | null {
  if (!a || (q.status !== 'accepted' && q.status !== 'converted') || a.quoteTotalCents !== q.totalCents) return null;
  const data = a.signatureData?.trim() ?? '';
  const signature: SignedAcceptance['signature'] =
    a.signatureType === 'drawn' && PNG_DATA_URL.test(data)
      ? { kind: 'drawn', image: data }
      : a.signatureType === 'typed' && data
        ? { kind: 'typed', text: data }
        : null;
  return { name: a.customerName?.trim() || q.customerName, title: a.customerTitle?.trim() || null, date: documentDate(torontoDate(a.acceptedAt)), acceptedAt: documentDateTime(a.acceptedAt), signature };
}

export function quoteDocument(q: QuoteDto, config: DocumentConfig, accepted: DocumentAcceptance | null = null): DocumentModel {
  const totals = chargeRows(q);
  const deposit: DocumentTotalRow[] =
    q.depositType !== 'none' && q.depositRequiredCents > 0
      ? [{ label: `Deposit required${q.depositType === 'percent' ? ` (${formatBp(q.depositValue)})` : ''}`, value: money(q.depositRequiredCents), tone: 'paid' }]
      : [];
  const cardRow: PaymentRow[] = config.payment.cards.length ? [{ label: 'Card payment', value: `We accept: ${config.payment.cards.join(', ')}` }] : [];
  const etransfer: PaymentRow[] = config.payment.etransferEmail ? [{ label: 'E-Transfer', value: config.payment.etransferEmail }] : [];
  return {
    kind: 'quote',
    title: 'Quote',
    subtitle: 'EVENT PRODUCTION ESTIMATE',
    number: q.quoteNumber,
    fileName: documentFileName(config.companyName, 'Quote', q.quoteNumber),
    company: config,
    customer: customerOf('Quote prepared for:', q),
    metaHeading: 'Quote details:',
    meta: [
      { label: 'Quote N°', value: q.quoteNumber, strong: true },
      { label: 'Quote date', value: documentDate(q.quoteDate) },
      { label: 'Valid until', value: documentDate(q.validUntil) },
    ],
    event: eventRows(q),
    banner: { label: 'Total estimate', value: money(q.totalCents) },
    sections: sectionsOf(q.items),
    totals,
    grandTotal: { label: 'Total estimate', value: money(q.totalCents) },
    afterGrandTotal: deposit,
    payment: q.showPaymentDetails
      ? {
          title: config.payment.methods.length ? `Payment method: ${config.payment.methods.join(', ')}` : 'Payment',
          reference: null,
          rows: [...etransfer, ...cardRow],
          note: config.email,
        }
      : null,
    questions: questionsOf(config, 'quote', q.quoteNumber),
    notes: q.notes,
    terms: splitTerms(q.terms),
    termsAside: 'Please read before signing',
    termsPlacement: termsPlacement(q.showPaymentDetails, splitTerms(q.terms)),
    acceptance: { authorizedBy: `Authorized by · ${config.companyName}`, customerStatement: 'I accept this quote, its pricing and the terms above.', signed: signedAcceptance(q, accepted) },
    paymentStatus: null,
    continuation: { left: `Quote · ${q.quoteNumber}`, right: `${q.customerName} · continued` },
    footerNote: config.quoteFooterNote,
  };
}

export function invoiceDocument(inv: InvoiceDto, config: DocumentConfig): DocumentModel {
  const itemDiscountsCents = inv.items.reduce((sum, i) => sum + i.discountCents, 0);
  const totals = chargeRows({ ...inv, itemDiscountsCents });
  totals.push({ label: 'Invoice total', value: money(inv.totalCents), tone: 'plain', strong: true });
  if (inv.depositPaidCents > 0) totals.push({ label: 'Deposit paid', value: minus(inv.depositPaidCents), tone: 'paid' });
  if (inv.amountPaidCents > 0) totals.push({ label: 'Amount paid', value: minus(inv.amountPaidCents), tone: 'paid' });

  const bank = config.payment.bank;
  const payRows: PaymentRow[] = [
    ...(config.payment.etransferEmail ? [{ label: 'E-Transfer', value: config.payment.etransferEmail }] : []),
    ...(bank && bank.bankName && bank.transit && bank.institution && bank.account
      ? [{ label: 'Bank transfer', value: `${bank.bankName} · Transit ${bank.transit} · Inst. ${bank.institution} · Acct ${bank.account}` }]
      : []),
    ...(config.payment.cards.length
      ? [{ label: 'Card', value: `${config.payment.cards.join(', ')}${config.payment.cardNote ? ` (${config.payment.cardNote.toLowerCase()})` : ''}` }]
      : []),
  ];

  // Read-only timeline built from what the invoice records today.
  const paid = inv.status === 'paid' || inv.balanceDueCents <= 0;
  const steps: StatusStep[] = [];
  if (inv.quoteNumber) steps.push({ label: 'Quote accepted', detail: inv.quoteAcceptedAt ? documentDate(inv.quoteAcceptedAt) : null, value: inv.quoteNumber, state: 'done' });
  if (inv.depositPaidCents > 0) steps.push({ label: 'Deposit received', detail: null, value: money(inv.depositPaidCents), state: 'done' });
  if (inv.amountPaidCents > 0) steps.push({ label: 'Payments received', detail: null, value: money(inv.amountPaidCents), state: 'done' });
  steps.push(
    paid
      ? { label: 'Paid in full', detail: inv.paidAt ? documentDate(inv.paidAt) : null, value: money(inv.totalCents), state: 'done' }
      : { label: 'Balance due', detail: documentDate(inv.dueDate), value: money(inv.balanceDueCents), state: 'current' },
  );
  const voided = inv.status === 'void';

  return {
    kind: 'invoice',
    title: 'Invoice',
    subtitle: 'EVENT PRODUCTION SERVICES',
    number: inv.invoiceNumber,
    fileName: documentFileName(config.companyName, 'Invoice', inv.invoiceNumber),
    company: config,
    customer: customerOf('Bill to:', inv),
    metaHeading: 'Invoice details:',
    meta: [
      { label: 'Invoice N°', value: inv.invoiceNumber, strong: true },
      { label: 'Invoice date', value: documentDate(inv.invoiceDate) },
      { label: 'Due date', value: documentDate(inv.dueDate), strong: true },
      ...(inv.quoteNumber ? [{ label: 'Quote ref', value: inv.quoteNumber }] : []),
    ],
    event: eventRows(inv),
    banner: { label: 'Balance due', value: money(inv.balanceDueCents) },
    sections: sectionsOf(inv.items),
    totals,
    grandTotal: { label: 'Balance due', value: money(inv.balanceDueCents) },
    afterGrandTotal: [],
    payment: inv.showPaymentDetails ? { title: 'How to pay', reference: `Reference: ${inv.invoiceNumber}`, rows: payRows, note: null } : null,
    questions: questionsOf(config, 'invoice', null),
    notes: inv.notes,
    terms: splitTerms(inv.terms),
    termsAside: 'Payment terms',
    termsPlacement: termsPlacement(inv.showPaymentDetails, splitTerms(inv.terms)),
    acceptance: null,
    paymentStatus: {
      caption: inv.quoteNumber && inv.quoteAcceptedAt ? `Accepted from quote ${inv.quoteNumber} on ${documentDate(inv.quoteAcceptedAt)}` : null,
      steps,
      badge: voided ? 'Void' : paid ? 'Paid' : 'Unpaid balance',
      badgeTone: voided ? 'void' : paid ? 'paid' : 'due',
      badgeNote: voided ? 'This invoice has been voided.' : paid ? 'Received in full — thank you.' : 'Status updates to PAID once the balance is received in full.',
    },
    continuation: { left: `Invoice · ${inv.invoiceNumber}`, right: `${inv.customerName} · continued` },
    footerNote: config.invoiceFooterNote,
  };
}
