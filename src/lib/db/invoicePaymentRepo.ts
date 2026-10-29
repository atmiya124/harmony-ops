// Money received against invoices (Phase 5). Every change runs in one
// transaction that also brings the invoice's paid figures, balance and
// status back in line with its live payments (see sales/invoicePayments),
// and writes a sales_audit_log entry. Payments are never deleted: one
// recorded by mistake is voided, and drops out of every total.
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './client';
import { invoicePayments, invoices } from './schema';
import { FinanceError, nextTimestamp, type Actor, type Tx } from './financeRepo';
import { getInvoice, salesAudit, type InvoiceDto } from './invoiceRepo';
import { invoicePaymentTotals, invoiceStatusAfterPayments, paymentBlocker } from '../sales/invoicePayments';
import type { InvoicePaymentKind, InvoicePaymentMethod } from '../sales/types';
import type { InvoicePaymentInput, VoidPaymentInput } from '../schemas/invoice';
import { formatCents } from '../money';

const staleInvoice = 'Someone else changed this invoice. Review their changes and try again.';

// Re-derives the invoice's paid figures and status from its live payments
// and saves them, only if the invoice is still at `version`.
async function settleInvoice(tx: Tx, invoiceId: string, version: string, actor: Actor): Promise<void> {
  const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
  const payments = await tx.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, invoiceId));
  const totals = invoicePaymentTotals(invoice.totalCents, payments);
  const status = invoiceStatusAfterPayments(invoice, totals);
  const at = nextTimestamp(version);
  const [saved] = await tx
    .update(invoices)
    .set({
      depositPaidCents: totals.depositPaidCents,
      amountPaidCents: totals.amountPaidCents,
      balanceDueCents: totals.balanceDueCents,
      status,
      statusChangedAt: status === invoice.status ? invoice.statusChangedAt : at,
      paidAt: status === 'paid' ? (invoice.paidAt ?? at) : null,
      updatedByEmail: actor.email,
      updatedAt: at,
    })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.updatedAt, version)))
    .returning({ id: invoices.id });
  if (!saved) throw new FinanceError(409, staleInvoice);
}

async function liveInvoice(tx: Tx, invoiceId: string, expectedUpdatedAt: string) {
  const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)));
  if (!invoice) throw new FinanceError(404, 'Invoice not found');
  if (invoice.updatedAt !== expectedUpdatedAt) throw new FinanceError(409, staleInvoice, undefined, await getInvoice(invoiceId, tx));
  return invoice;
}

// Records a payment received (dated on or before `today`, never more than
// the balance due). Retrying with the same payment id returns the invoice
// as it now is instead of recording it twice.
export async function recordInvoicePayment(invoiceId: string, input: InvoicePaymentInput, today: string, actor: Actor): Promise<InvoiceDto> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ invoiceId: invoicePayments.invoiceId, by: invoicePayments.recordedByUserId }).from(invoicePayments).where(eq(invoicePayments.id, input.paymentId));
    if (existing) {
      if (existing.invoiceId !== invoiceId || existing.by !== actor.id) throw new FinanceError(409, 'A payment with this id already exists');
      return (await getInvoice(invoiceId, tx))!;
    }

    const invoice = await liveInvoice(tx, invoiceId, input.expectedUpdatedAt);
    const blocker = paymentBlocker(invoice);
    if (blocker) throw new FinanceError(409, blocker, undefined, await getInvoice(invoiceId, tx));
    if (input.receivedOn > today) throw new FinanceError(422, 'A payment can’t be received in the future', { receivedOn: ['Can’t be after today'] });
    if (input.amountCents > invoice.balanceDueCents) {
      throw new FinanceError(422, `That’s more than the balance due (${formatCents(invoice.balanceDueCents)})`, { amountCents: [`Can’t be more than ${formatCents(invoice.balanceDueCents)}`] });
    }

    const at = nextTimestamp(invoice.updatedAt);
    const [payment] = await tx
      .insert(invoicePayments)
      .values({
        id: input.paymentId,
        invoiceId,
        kind: 'payment',
        amountCents: input.amountCents,
        method: input.method,
        receivedOn: input.receivedOn,
        reference: input.reference,
        recordedByUserId: actor.id,
        recordedByEmail: actor.email,
        createdAt: at,
      })
      .returning();
    await settleInvoice(tx, invoiceId, invoice.updatedAt, actor);
    await salesAudit(tx, { entityType: 'invoice', entityId: invoiceId, action: 'payment', actor, before: invoice, after: { payment }, at });
    return (await getInvoice(invoiceId, tx))!;
  });
}

// Undoes a payment recorded by mistake: it stays in the history, marked
// voided, and no longer counts towards the invoice.
export async function voidInvoicePayment(invoiceId: string, paymentId: string, input: VoidPaymentInput, actor: Actor): Promise<InvoiceDto> {
  return db.transaction(async (tx) => {
    const invoice = await liveInvoice(tx, invoiceId, input.expectedUpdatedAt);
    const [payment] = await tx.select().from(invoicePayments).where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.invoiceId, invoiceId)));
    if (!payment) throw new FinanceError(404, 'Payment not found');
    if (payment.voidedAt) throw new FinanceError(409, 'This payment was already undone.', undefined, await getInvoice(invoiceId, tx));

    const at = nextTimestamp(invoice.updatedAt);
    const [voided] = await tx
      .update(invoicePayments)
      .set({ voidedAt: at, voidedByEmail: actor.email, voidReason: input.reason })
      .where(and(eq(invoicePayments.id, paymentId), isNull(invoicePayments.voidedAt)))
      .returning();
    if (!voided) throw new FinanceError(409, 'This payment was already undone.');
    await settleInvoice(tx, invoiceId, invoice.updatedAt, actor);
    await salesAudit(tx, { entityType: 'invoice', entityId: invoiceId, action: 'payment', actor, before: { payment }, after: { payment: voided }, at });
    return (await getInvoice(invoiceId, tx))!;
  });
}

// Notes the receipt email that went out for a payment (the latest one).
export async function markReceiptSent(paymentId: string, to: string, at: string): Promise<void> {
  await db.update(invoicePayments).set({ receiptSentAt: at, receiptSentTo: to }).where(eq(invoicePayments.id, paymentId));
}

// A payment received, as Finances lists it.
export interface ReceivedPaymentDto {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  kind: InvoicePaymentKind;
  amountCents: number; // tax included: what the client paid
  method: InvoicePaymentMethod | null;
  receivedOn: string;
}

// Every live payment on an invoice that hasn't been deleted, newest first.
export async function listReceivedPayments(): Promise<ReceivedPaymentDto[]> {
  return db
    .select({
      id: invoicePayments.id,
      invoiceId: invoicePayments.invoiceId,
      invoiceNumber: invoices.invoiceNumber,
      customerName: invoices.customerName,
      kind: invoicePayments.kind,
      amountCents: invoicePayments.amountCents,
      method: invoicePayments.method,
      receivedOn: invoicePayments.receivedOn,
    })
    .from(invoicePayments)
    .innerJoin(invoices, eq(invoices.id, invoicePayments.invoiceId))
    .where(and(isNull(invoicePayments.voidedAt), isNull(invoices.deletedAt)))
    .orderBy(desc(invoicePayments.receivedOn), desc(invoicePayments.createdAt));
}
