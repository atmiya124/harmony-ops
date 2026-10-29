// Invoice data access. Invoices are created from an accepted quote
// (convertQuoteToInvoice), copying its items and figures. Money received
// is recorded as invoice_payments rows (invoicePaymentRepo), which keep the
// invoice's paid figures and status in step.
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { db } from './client';
import { invoiceItems, invoicePayments, invoices, quoteItems, quotes, salesAuditLog, type InvoicePaymentRow, type InvoiceRow } from './schema';
import { FinanceError, nextTimestamp, type Actor, type Tx } from './financeRepo';
import { nextDocumentNumber } from './documentNumbers';
import { getQuote, type QuoteDto, type QuoteItemDto } from './quoteRepo';
import { convertBlocker } from '../sales/invoiceFromQuote';
import { invoicePaymentTotals, invoiceStatusAfterPayments } from '../sales/invoicePayments';
import type { AdjustmentType, InvoicePaymentKind, InvoicePaymentMethod, InvoiceStatus, SalesAuditAction, SalesAuditEntityType } from '../sales/types';
import type { InvoiceListQuery, InvoicePoInput, QuoteConvertInput } from '../schemas/invoice';

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
  clientPoNumber: string | null;
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
  statusChangedAt: string | null;
  sentAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdByEmail: string;
  notes: string | null;
  terms: string | null;
  showPaymentDetails: boolean; // print the payment section on the PDF
  items: QuoteItemDto[]; // same shape as a quote's items
  payments: InvoicePaymentDto[]; // newest first, undone ones included
}

export interface InvoicePaymentDto {
  id: string;
  kind: InvoicePaymentKind;
  amountCents: number;
  method: InvoicePaymentMethod | null; // null: a deposit recorded before payments existed
  receivedOn: string;
  reference: string | null;
  recordedByEmail: string;
  createdAt: string;
  voidedAt: string | null;
  voidedByEmail: string | null;
  voidReason: string | null;
  receiptSentAt: string | null;
  receiptSentTo: string | null;
}

export function toPaymentDto(p: InvoicePaymentRow): InvoicePaymentDto {
  return {
    id: p.id,
    kind: p.kind,
    amountCents: p.amountCents,
    method: p.method,
    receivedOn: p.receivedOn,
    reference: p.reference,
    recordedByEmail: p.recordedByEmail,
    createdAt: p.createdAt,
    voidedAt: p.voidedAt,
    voidedByEmail: p.voidedByEmail,
    voidReason: p.voidReason,
    receiptSentAt: p.receiptSentAt,
    receiptSentTo: p.receiptSentTo,
  };
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

export async function getInvoice(id: string, reader: Tx | typeof db = db): Promise<InvoiceDto | null> {
  const [row] = await reader.select().from(invoices).where(and(eq(invoices.id, id), isNull(invoices.deletedAt)));
  if (!row) return null;
  const [items, quote, payments] = await Promise.all([
    reader.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.sortOrder)),
    row.quoteId ? reader.select({ quoteNumber: quotes.quoteNumber, acceptedAt: quotes.acceptedAt }).from(quotes).where(eq(quotes.id, row.quoteId)) : Promise.resolve([]),
    reader.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, id)).orderBy(desc(invoicePayments.receivedOn), desc(invoicePayments.createdAt)),
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
    clientPoNumber: row.clientPoNumber,
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
    statusChangedAt: row.statusChangedAt,
    sentAt: row.sentAt,
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
    createdByEmail: row.createdByEmail,
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
    payments: payments.map(toPaymentDto),
  };
}

// ---------------------------------------------------------------------------
// Converting an accepted quote
// ---------------------------------------------------------------------------

// One sales_audit_log entry. Shared with invoicePaymentRepo.
export async function salesAudit(tx: Tx, entry: { entityType: SalesAuditEntityType; entityId: string; action: SalesAuditAction; actor: Actor; before: unknown; after: unknown; at: string }) {
  await tx.insert(salesAuditLog).values({
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    changedByUserId: entry.actor.id,
    changedByEmail: entry.actor.email,
    changedAt: entry.at,
    before: entry.before === null ? null : JSON.stringify(entry.before),
    after: entry.after === null ? null : JSON.stringify(entry.after),
  });
}

const staleQuote = 'Someone else changed this quote. Review their changes and try again.';

// Makes the invoice for an accepted quote, in one transaction: the next
// invoice number, the quote's customer, event, items and figures copied
// exactly (nothing is recalculated, so the invoice is what the client
// agreed to), dated `today`, and the quote marked Converted — which locks
// it and stops a second invoice. A deposit the client already paid is
// recorded as the invoice's first payment and comes off the balance due. Retrying with the
// same invoice id returns the quote as it now is instead of failing.
//
// Unlike booking, this works for a quote marked Accepted by hand too: an
// invoice is a bill staff choose to issue, not something the client's
// answer sets off.
export async function convertQuoteToInvoice(quoteId: string, input: QuoteConvertInput, today: string, actor: Actor): Promise<QuoteDto> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ quoteId: invoices.quoteId, createdByUserId: invoices.createdByUserId }).from(invoices).where(eq(invoices.id, input.invoiceId));
    if (existing) {
      if (existing.quoteId !== quoteId || existing.createdByUserId !== actor.id) throw new FinanceError(409, 'An invoice with this id already exists');
      return (await getQuote(quoteId, tx))!;
    }

    const [quote] = await tx.select().from(quotes).where(and(eq(quotes.id, quoteId), isNull(quotes.deletedAt)));
    if (!quote) throw new FinanceError(404, 'Quote not found');
    if (quote.updatedAt !== input.expectedUpdatedAt) throw new FinanceError(409, staleQuote, undefined, await getQuote(quoteId, tx));
    const blocker = convertBlocker(quote.status);
    if (blocker) throw new FinanceError(409, blocker, undefined, await getQuote(quoteId, tx));
    if (input.dueDate < today) throw new FinanceError(422, "The due date can't be before today", { dueDate: ["Can't be before today"] });
    if (input.depositPaidCents > quote.totalCents) {
      throw new FinanceError(422, "The deposit can't be more than the invoice total", { depositPaidCents: ["Can't be more than the total"] });
    }
    const depositReceivedOn = input.depositReceivedOn ?? today;
    if (input.depositPaidCents > 0 && depositReceivedOn > today) {
      throw new FinanceError(422, "The deposit can't be received in the future", { depositReceivedOn: ["Can't be after today"] });
    }

    const at = nextTimestamp(quote.updatedAt);
    const deposit =
      input.depositPaidCents > 0
        ? { kind: 'deposit' as const, amountCents: input.depositPaidCents, method: input.depositMethod, receivedOn: depositReceivedOn, voidedAt: null }
        : null;
    const totals = invoicePaymentTotals(quote.totalCents, deposit ? [deposit] : []);
    const status = invoiceStatusAfterPayments({ status: 'draft', sentAt: null }, totals);
    const [invoice] = await tx
      .insert(invoices)
      .values({
        id: input.invoiceId,
        invoiceNumber: await nextDocumentNumber(tx, 'invoice'),
        quoteId,
        status,
        customerName: quote.customerName,
        customerCompany: quote.customerCompany,
        customerEmail: quote.customerEmail,
        customerPhone: quote.customerPhone,
        billingAddress: quote.billingAddress,
        eventId: quote.eventId,
        eventName: quote.eventName,
        eventDate: quote.eventDate,
        venueName: quote.venueName,
        venueAddress: quote.venueAddress,
        invoiceDate: today,
        dueDate: input.dueDate,
        // Omitted: the quote's; the convert dialog may add or change it.
        clientPoNumber: input.clientPoNumber === undefined ? quote.clientPoNumber : input.clientPoNumber,
        currency: quote.currency,
        subtotalCents: quote.subtotalCents,
        discountType: quote.discountType,
        discountValue: quote.discountValue,
        discountCents: quote.discountCents,
        taxLabel: quote.taxLabel,
        taxRateBp: quote.taxRateBp,
        taxCents: quote.taxCents,
        totalCents: quote.totalCents,
        depositPaidCents: totals.depositPaidCents,
        amountPaidCents: totals.amountPaidCents,
        balanceDueCents: totals.balanceDueCents,
        notes: quote.notes,
        terms: quote.terms,
        showPaymentDetails: quote.showPaymentDetails,
        statusChangedAt: at,
        paidAt: status === 'paid' ? at : null,
        createdByUserId: actor.id,
        createdByEmail: actor.email,
        updatedByEmail: actor.email,
        createdAt: at,
        updatedAt: at,
      })
      .returning();

    const items = await tx.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId)).orderBy(asc(quoteItems.sortOrder));
    const copied = items.map((i) => ({
      id: randomUUID(),
      invoiceId: invoice.id,
      section: i.section,
      itemName: i.itemName,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      lineTotalCents: i.lineTotalCents,
      discountType: i.discountType,
      discountValue: i.discountValue,
      discountCents: i.discountCents,
      sortOrder: i.sortOrder,
      createdAt: at,
      updatedAt: at,
    }));
    if (copied.length > 0) await tx.insert(invoiceItems).values(copied);
    if (deposit) {
      await tx.insert(invoicePayments).values({
        id: randomUUID(),
        invoiceId: invoice.id,
        kind: deposit.kind,
        amountCents: deposit.amountCents,
        method: deposit.method,
        receivedOn: deposit.receivedOn,
        recordedByUserId: actor.id,
        recordedByEmail: actor.email,
        createdAt: at,
      });
    }

    const [converted] = await tx
      .update(quotes)
      .set({ status: 'converted', statusChangedAt: at, updatedByEmail: actor.email, updatedAt: at })
      .where(and(eq(quotes.id, quoteId), eq(quotes.updatedAt, quote.updatedAt)))
      .returning();
    if (!converted) throw new FinanceError(409, staleQuote);

    await salesAudit(tx, { entityType: 'invoice', entityId: invoice.id, action: 'create', actor, before: null, after: { ...invoice, items: copied }, at });
    await salesAudit(tx, { entityType: 'quote', entityId: quoteId, action: 'convert', actor, before: quote, after: { ...converted, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber }, at });
    return (await getQuote(quoteId, tx))!;
  });
}

// Adds, changes or clears the client's PO number, often sent only once the
// invoice is in hand. Any invoice but a void one; the figures don't change.
export async function updateInvoicePo(id: string, input: InvoicePoInput, actor: Actor): Promise<InvoiceDto> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(invoices).where(and(eq(invoices.id, id), isNull(invoices.deletedAt)));
    if (!before) throw new FinanceError(404, 'Invoice not found');
    if (before.updatedAt !== input.expectedUpdatedAt) throw new FinanceError(409, 'Someone else changed this invoice. Review their changes and try again.', undefined, await getInvoice(id, tx));
    if (before.status === 'void') throw new FinanceError(409, 'This invoice is void.');
    if (before.clientPoNumber === input.clientPoNumber) return (await getInvoice(id, tx))!;

    const at = nextTimestamp(before.updatedAt);
    const [after] = await tx
      .update(invoices)
      .set({ clientPoNumber: input.clientPoNumber, updatedAt: at, updatedByEmail: actor.email })
      .where(and(eq(invoices.id, id), eq(invoices.updatedAt, before.updatedAt)))
      .returning();
    if (!after) throw new FinanceError(409, 'Someone else changed this invoice. Review their changes and try again.');
    await salesAudit(tx, { entityType: 'invoice', entityId: id, action: 'update', actor, before: { clientPoNumber: before.clientPoNumber }, after: { clientPoNumber: after.clientPoNumber }, at });
    return (await getInvoice(id, tx))!;
  });
}
