// Invoice data access. Phase 1 only reads: invoices are created from an
// accepted quote in Phase 4 (copying its items and figures, numbered with
// nextDocumentNumber(tx, 'invoice')), and payments arrive in Phase 5.
import { and, asc, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { db } from './client';
import { invoiceItems, invoices, quotes, type InvoiceRow } from './schema';
import type { AdjustmentType, InvoiceStatus } from '../sales/types';
import type { InvoiceListQuery } from '../schemas/invoice';
import type { QuoteItemDto } from './quoteRepo';

export interface InvoiceSummaryDto {
  id: string;
  invoiceNumber: string;
  quoteId: string | null;
  status: InvoiceStatus;
  customerName: string;
  customerCompany: string | null;
  eventName: string | null;
  eventDate: string | null;
  invoiceDate: string;
  dueDate: string;
  totalCents: number;
  balanceDueCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDto extends InvoiceSummaryDto {
  quoteNumber: string | null;
  quoteAcceptedAt: string | null; // when the source quote was accepted, if any
  customerEmail: string | null;
  customerPhone: string | null;
  billingAddress: string | null;
  eventId: number | null;
  venueName: string | null;
  venueAddress: string | null;
  currency: string;
  subtotalCents: number;
  discountType: AdjustmentType;
  discountValue: number;
  discountCents: number;
  taxLabel: string;
  taxRateBp: number;
  taxCents: number;
  depositPaidCents: number;
  amountPaidCents: number;
  paidAt: string | null;
  notes: string | null;
  terms: string | null;
  showPaymentDetails: boolean; // print the payment section on the PDF
  items: QuoteItemDto[]; // same shape as a quote's items
}

function toSummary(r: InvoiceRow): InvoiceSummaryDto {
  return {
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    quoteId: r.quoteId,
    status: r.status,
    customerName: r.customerName,
    customerCompany: r.customerCompany,
    eventName: r.eventName,
    eventDate: r.eventDate,
    invoiceDate: r.invoiceDate,
    dueDate: r.dueDate,
    totalCents: r.totalCents,
    balanceDueCents: r.balanceDueCents,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listInvoices(filter: InvoiceListQuery = {}): Promise<InvoiceSummaryDto[]> {
  const where: SQL[] = [isNull(invoices.deletedAt)];
  if (filter.status) where.push(eq(invoices.status, filter.status));
  if (filter.quoteId) where.push(eq(invoices.quoteId, filter.quoteId));
  const rows = await db
    .select()
    .from(invoices)
    .where(and(...where))
    .orderBy(desc(invoices.invoiceNumber));
  return rows.map(toSummary);
}

export async function getInvoice(id: string): Promise<InvoiceDto | null> {
  const [row] = await db.select().from(invoices).where(and(eq(invoices.id, id), isNull(invoices.deletedAt)));
  if (!row) return null;
  const [items, quote] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.sortOrder)),
    row.quoteId ? db.select({ quoteNumber: quotes.quoteNumber, acceptedAt: quotes.acceptedAt }).from(quotes).where(eq(quotes.id, row.quoteId)) : Promise.resolve([]),
  ]);
  return {
    ...toSummary(row),
    quoteNumber: quote[0]?.quoteNumber ?? null,
    quoteAcceptedAt: quote[0]?.acceptedAt ?? null,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    billingAddress: row.billingAddress,
    eventId: row.eventId,
    venueName: row.venueName,
    venueAddress: row.venueAddress,
    currency: row.currency,
    subtotalCents: row.subtotalCents,
    discountType: row.discountType,
    discountValue: row.discountValue,
    discountCents: row.discountCents,
    taxLabel: row.taxLabel,
    taxRateBp: row.taxRateBp,
    taxCents: row.taxCents,
    depositPaidCents: row.depositPaidCents,
    amountPaidCents: row.amountPaidCents,
    paidAt: row.paidAt,
    notes: row.notes,
    terms: row.terms,
    showPaymentDetails: row.showPaymentDetails,
    items: items.map((i) => ({
      id: i.id,
      section: i.section,
      itemName: i.itemName,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      lineTotalCents: i.lineTotalCents,
      discountType: i.discountType,
      discountValue: i.discountValue,
      discountCents: i.discountCents,
      netTotalCents: i.lineTotalCents - i.discountCents,
      sortOrder: i.sortOrder,
    })),
  };
}
