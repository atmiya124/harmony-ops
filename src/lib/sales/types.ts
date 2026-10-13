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
