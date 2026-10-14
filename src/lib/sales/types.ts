// The quotes & invoices vocabulary shared by the database schema, server
// validation and UI. Stored values are stable snake_case keys (like the
// finance module); labels are display-only and can change freely.
//
// The shared database only ever accepts new tables (see migrationGuard), so
// CHECK constraints can't be widened later: every status the later phases
// need (sending, client viewing, acceptance, conversion, payments) is
// listed here already, even where Phase 1 doesn't use it yet.

export const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted', 'cancelled'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  converted: 'Converted',
  cancelled: 'Cancelled',
};

// Statuses a partner can set by hand in Phase 1. `viewed` comes from the
// client link (Phase 3), `converted` from creating the invoice (Phase 4).
export const MANUAL_QUOTE_STATUSES: readonly QuoteStatus[] = ['draft', 'sent', 'accepted', 'declined', 'expired'];

// Once accepted the price is what the client agreed to, so the quote is
// locked; once converted, the invoice is the record.
export function isQuoteEditable(status: QuoteStatus): boolean {
  return status === 'draft' || status === 'sent' || status === 'viewed' || status === 'declined' || status === 'expired';
}

// Why a quote can't be deleted, or null if it can. An accepted or converted
// quote (or one with invoices) is the record of an agreement, so it stays.
export function quoteDeleteBlocker(status: QuoteStatus, invoiceCount: number): string | null {
  if (status === 'accepted' || status === 'converted') return `${QUOTE_STATUS_LABELS[status]} quotes can't be deleted.`;
  if (invoiceCount > 0) return "Quotes with invoices can't be deleted.";
  return null;
}

// Statuses a quote can be emailed to the client from (a draft is sent by
// it; a sent or viewed one can be sent again).
export const EMAILABLE_QUOTE_STATUSES: readonly QuoteStatus[] = ['draft', 'sent', 'viewed'];

export function canSetQuoteStatus(from: QuoteStatus, to: QuoteStatus): boolean {
  if (from === to) return false;
  if (from === 'converted' || from === 'cancelled') return false;
  return MANUAL_QUOTE_STATUSES.includes(to);
}

export const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  void: 'Void',
};

// Discounts and deposits share one shape: `percent` values are basis points
// (500 = 5.00%), `fixed` values are cents, `none` stores 0.
export const ADJUSTMENT_TYPES = ['none', 'percent', 'fixed'] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  none: 'None',
  percent: 'Percentage',
  fixed: 'Fixed amount',
};

// Offered in the builder; any other section name can be typed in.
export const SECTION_PRESETS = ['LED Display', 'Sound', 'Stage', 'Lighting', 'Services', 'Transport', 'Labour', 'Other'] as const;

export const MAX_QUOTE_ITEMS = 200;
export const MAX_ITEM_QUANTITY = 10_000;
export const MAX_PERCENT_BP = 10_000; // 100.00%

export const SALES_AUDIT_ENTITY_TYPES = ['quote', 'invoice'] as const;
export type SalesAuditEntityType = (typeof SALES_AUDIT_ENTITY_TYPES)[number];

export const SALES_AUDIT_ACTIONS = ['create', 'update', 'status', 'convert', 'payment', 'void', 'delete', 'restore'] as const;
export type SalesAuditAction = (typeof SALES_AUDIT_ACTIONS)[number];

// Client quote links (Phase 3). The client's answer to a quote:
export const QUOTE_RESPONSE_ACTIONS = ['accepted', 'declined'] as const;
export type QuoteResponseAction = (typeof QUOTE_RESPONSE_ACTIONS)[number];

export const SIGNATURE_TYPES = ['typed', 'drawn'] as const;
export type SignatureType = (typeof SIGNATURE_TYPES)[number];

// What happened around a client link, for quote_activity. (sales_audit_log's
// action CHECK can't be widened on the shared database, so these live in
// their own table; status changes still go to sales_audit_log too.)
export const QUOTE_ACTIVITY_EVENTS = ['client_link_created', 'client_link_revoked', 'quote_viewed', 'quote_accepted', 'quote_declined'] as const;
export type QuoteActivityEvent = (typeof QUOTE_ACTIVITY_EVENTS)[number];

// How the client will pay a quote. Null (not chosen) lists every method on
// the PDF, as before this option existed.
export const QUOTE_PAYMENT_METHODS = ['etransfer', 'card', 'bank_transfer', 'cash'] as const;
export type QuotePaymentMethod = (typeof QUOTE_PAYMENT_METHODS)[number];
export const QUOTE_PAYMENT_METHOD_LABELS: Record<QuotePaymentMethod, string> = {
  etransfer: 'E-Transfer',
  card: 'Credit card',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
};

// Harmony Production charges no HST on cash payments: a cash quote's tax
// rate is always 0, whatever rate was typed. Used by the builder preview,
// validation and the server's stored totals alike.
export function effectiveTaxRateBp(paymentMethod: QuotePaymentMethod | null, taxRateBp: number): number {
  return paymentMethod === 'cash' ? 0 : taxRateBp;
}

// A quote email is the quote's first one, or a resend.
export const QUOTE_EMAIL_SEND_KINDS = ['first', 'resend'] as const;
export type QuoteEmailSendKind = (typeof QUOTE_EMAIL_SEND_KINDS)[number];

export const ACTIVITY_ACTORS = ['staff', 'client'] as const;
export type ActivityActor = (typeof ACTIVITY_ACTORS)[number];

// A drawn signature is stored as a small PNG data URL; this caps it.
export const MAX_SIGNATURE_DATA_LENGTH = 200_000;

// Counters in document_sequences.
export const DOCUMENT_SEQUENCES = ['quote', 'invoice'] as const;
export type DocumentSequence = (typeof DOCUMENT_SEQUENCES)[number];

// Sequential, server-assigned document numbers: Q-000000001, INV-000000001.
export const QUOTE_NUMBER_PREFIX = 'Q-';
export const INVOICE_NUMBER_PREFIX = 'INV-';
const NUMBER_DIGITS = 9;

export function formatDocumentNumber(prefix: string, n: number): string {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`document number must be a positive integer, got ${n}`);
  return `${prefix}${String(n).padStart(NUMBER_DIGITS, '0')}`;
}
