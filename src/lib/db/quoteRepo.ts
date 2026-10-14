// Quote data access. Every write runs in one transaction with its
// sales_audit_log entry, and every save recalculates the totals with
// quoteCalculator — figures from the browser are never stored. Field-level
// validation happens earlier, in src/lib/schemas/quote.ts.
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from './client';
import { bookings, financeSettings, invoices, quoteAccessLinks, quoteEmailSends, quoteItems, quotes, salesAuditLog, type QuoteItemRow, type QuoteRow } from './schema';
import { FinanceError, nextTimestamp, nowIso, type Actor, type Tx } from './financeRepo';
import { nextDocumentNumber } from './documentNumbers';
import { calculateQuoteTotals } from '../quoteCalculator';
import { QUOTE_DEFAULTS, type QuoteDefaults } from '../sales/defaults';
import { canSetQuoteStatus, isQuoteEditable, quoteDeleteBlocker, QUOTE_STATUS_LABELS, type AdjustmentType, type InvoiceStatus, type QuoteEmailSendKind, type QuotePaymentMethod, type QuoteStatus, type SalesAuditAction, effectiveTaxRateBp } from '../sales/types';
import type { QuoteCreateInput, QuoteStatusInput, QuoteUpdateInput } from '../schemas/quote';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface QuoteItemDto {
  id: string;
  section: string;
  itemName: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number; // quantity × unit price
  discountType: AdjustmentType; // this line's own discount
  discountValue: number;
  discountCents: number;
  netTotalCents: number; // what the line adds to the subtotal
  sortOrder: number;
}

export interface QuoteSummaryDto {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  customerName: string;
  customerCompany: string | null;
  eventName: string | null;
  eventDate: string | null;
  quoteDate: string;
  validUntil: string;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDto extends QuoteSummaryDto {
  customerEmail: string | null;
  customerPhone: string | null;
  billingAddress: string | null;
  eventId: number | null;
  // The linked booking as it is now; null when unlinked or since deleted.
  event: { id: number; title: string; eventDate: string } | null;
  eventDeleted: boolean;
  venueName: string | null;
  venueAddress: string | null;
  currency: string;
  itemDiscountsCents: number; // all line discounts together (already out of the subtotal)
  subtotalCents: number;
  discountType: AdjustmentType;
  discountValue: number;
  discountCents: number;
  taxLabel: string;
  taxRateBp: number;
  taxCents: number;
  depositType: AdjustmentType;
  depositValue: number;
  depositRequiredCents: number;
  notes: string | null;
  terms: string | null;
  showPaymentDetails: boolean; // print the payment section on the PDF
  paymentMethod: QuotePaymentMethod | null; // null = not chosen; cash = no HST
  statusChangedAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  createdByEmail: string;
  updatedByEmail: string;
  items: QuoteItemDto[];
  invoices: { id: string; invoiceNumber: string; status: InvoiceStatus }[];
  emailSends: QuoteEmailSendDto[]; // newest first
}

// One email of this quote that the provider accepted (see quote_email_sends).
export interface QuoteEmailSendDto {
  recipientEmail: string;
  kind: QuoteEmailSendKind;
  sentByEmail: string;
  sentAt: string;
}

function toSummary(r: QuoteRow): QuoteSummaryDto {
  return {
    id: r.id,
    quoteNumber: r.quoteNumber,
    status: r.status,
    customerName: r.customerName,
    customerCompany: r.customerCompany,
    eventName: r.eventName,
    eventDate: r.eventDate,
    quoteDate: r.quoteDate,
    validUntil: r.validUntil,
    totalCents: r.totalCents,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toItemDto(i: QuoteItemRow): QuoteItemDto {
  return {
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
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function audit(tx: Tx, entry: { entityId: string; action: SalesAuditAction; actor: Actor; before: unknown; after: unknown; at: string }) {
  await tx.insert(salesAuditLog).values({
    entityType: 'quote',
    entityId: entry.entityId,
    action: entry.action,
    changedByUserId: entry.actor.id,
    changedByEmail: entry.actor.email,
    changedAt: entry.at,
    before: entry.before === null ? null : JSON.stringify(entry.before),
    after: entry.after === null ? null : JSON.stringify(entry.after),
  });
}

// The full record (quote + items) as written to the audit log.
async function snapshot(reader: Tx, id: string) {
  const [quote] = await reader.select().from(quotes).where(eq(quotes.id, id));
  if (!quote) return null;
  const items = await reader.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).orderBy(asc(quoteItems.sortOrder));
  return { ...quote, items };
}

// A newly linked booking must exist; a link that isn't changing is kept even
// if Event-booking-app has since deleted the booking (the snapshot stays).
async function assertEventLink(reader: Tx, eventId: number | null, previousEventId?: number | null) {
  if (eventId === null || eventId === previousEventId) return;
  const [booking] = await reader.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, eventId));
  if (!booking) throw new FinanceError(422, 'That event no longer exists', { eventId: ['Choose an existing event'] });
}

// Recalculates every figure from the line items and rates.
function pricedQuote(input: QuoteCreateInput | QuoteUpdateInput) {
  const totals = calculateQuoteTotals({
    items: input.items.map((i) => ({ ...i, discount: { type: i.discountType, value: i.discountValue } })),
    discount: { type: input.discountType, value: input.discountValue },
    taxRateBp: effectiveTaxRateBp(input.paymentMethod, input.taxRateBp),
    deposit: { type: input.depositType, value: input.depositValue },
  });
  const fields = {
    customerName: input.customerName,
    customerCompany: input.customerCompany,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    billingAddress: input.billingAddress,
    eventId: input.eventId,
    eventName: input.eventName,
    eventDate: input.eventDate,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    quoteDate: input.quoteDate,
    validUntil: input.validUntil,
    subtotalCents: totals.subtotalCents,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountCents: totals.discountCents,
    taxLabel: input.taxLabel,
    // A cash quote stores 0%: the stored rate always matches the stored tax.
    taxRateBp: effectiveTaxRateBp(input.paymentMethod, input.taxRateBp),
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    depositType: input.depositType,
    depositValue: input.depositValue,
    depositRequiredCents: totals.depositRequiredCents,
    notes: input.notes,
    terms: input.terms,
    showPaymentDetails: input.showPaymentDetails,
    paymentMethod: input.paymentMethod,
  };
  return { fields, lines: { totals: totals.lineTotalsCents, discounts: totals.lineDiscountsCents } };
}

// Replaces a quote's items in order. Items that kept their id keep their
// original createdAt.
async function writeItems(tx: Tx, quoteId: string, input: QuoteCreateInput | QuoteUpdateInput, lines: { totals: number[]; discounts: number[] }, at: string, previous: QuoteItemRow[] = []) {
  const createdAtById = new Map(previous.map((i) => [i.id, i.createdAt]));
  const seen = new Set<string>();
  await tx.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  await tx.insert(quoteItems).values(
    input.items.map((item, index) => {
      // Ids must be unique; a repeated or foreign id just gets a fresh one.
      const keep = item.id && createdAtById.has(item.id) && !seen.has(item.id);
      const id = keep ? item.id! : randomUUID();
      seen.add(id);
      return {
        id,
        quoteId,
        section: item.section,
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: lines.totals[index],
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountCents: lines.discounts[index],
        sortOrder: index,
        createdAt: keep ? createdAtById.get(item.id!)! : at,
        updatedAt: at,
      };
    }),
  );
}

const staleMessage = 'Someone else changed this quote. Review their changes and try again.';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

// Newest first: numbers are handed out in order, so the highest is newest.
export async function listQuotes(): Promise<QuoteSummaryDto[]> {
  const rows = await db.select().from(quotes).where(isNull(quotes.deletedAt)).orderBy(desc(quotes.quoteNumber));
  return rows.map(toSummary);
}

export async function getQuote(id: string, reader: Tx | typeof db = db): Promise<QuoteDto | null> {
  const [row] = await reader.select().from(quotes).where(and(eq(quotes.id, id), isNull(quotes.deletedAt)));
  if (!row) return null;
  const [items, booking, linkedInvoices, sends] = await Promise.all([
    reader.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).orderBy(asc(quoteItems.sortOrder)),
    row.eventId !== null
      ? reader.select({ id: bookings.id, title: bookings.eventTitle, eventDate: bookings.eventDate }).from(bookings).where(eq(bookings.id, row.eventId))
      : Promise.resolve([]),
    reader
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.quoteId, id), isNull(invoices.deletedAt)))
      .orderBy(asc(invoices.invoiceNumber)),
    reader
      .select({ recipientEmail: quoteEmailSends.recipientEmail, kind: quoteEmailSends.kind, sentByEmail: quoteEmailSends.sentByEmail, sentAt: quoteEmailSends.sentAt })
      .from(quoteEmailSends)
      .where(eq(quoteEmailSends.quoteId, id))
      .orderBy(desc(quoteEmailSends.sentAt), desc(quoteEmailSends.id)),
  ]);
  const event = booking[0] ? { id: booking[0].id, title: booking[0].title || 'Untitled event', eventDate: booking[0].eventDate } : null;
  return {
    ...toSummary(row),
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    billingAddress: row.billingAddress,
    eventId: row.eventId,
    event,
    eventDeleted: row.eventId !== null && !event,
    venueName: row.venueName,
    venueAddress: row.venueAddress,
    currency: row.currency,
    itemDiscountsCents: items.reduce((sum, i) => sum + i.discountCents, 0),
    subtotalCents: row.subtotalCents,
    discountType: row.discountType,
    discountValue: row.discountValue,
    discountCents: row.discountCents,
    taxLabel: row.taxLabel,
    taxRateBp: row.taxRateBp,
    taxCents: row.taxCents,
    depositType: row.depositType,
    depositValue: row.depositValue,
    depositRequiredCents: row.depositRequiredCents,
    notes: row.notes,
    terms: row.terms,
    showPaymentDetails: row.showPaymentDetails,
    paymentMethod: row.paymentMethod,
    statusChangedAt: row.statusChangedAt,
    sentAt: row.sentAt,
    acceptedAt: row.acceptedAt,
    createdByEmail: row.createdByEmail,
    updatedByEmail: row.updatedByEmail,
    items: items.map(toItemDto),
    invoices: linkedInvoices,
    emailSends: sends,
  };
}

// Starting values for the New Quote screen: the policy defaults, with the
// tax rate from finance settings when one has been saved.
export async function getQuoteDefaults(): Promise<QuoteDefaults> {
  const [settings] = await db.select({ rate: financeSettings.defaultHstRateBp }).from(financeSettings).where(eq(financeSettings.id, 1));
  return { ...QUOTE_DEFAULTS, taxRateBp: settings?.rate ?? QUOTE_DEFAULTS.taxRateBp };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

// Creates a draft with the next quote number — or, when the same partner
// retries with an id that already exists (a flaky connection re-sending the
// save), returns that quote instead of creating a second one.
export async function createQuote(input: QuoteCreateInput, actor: Actor): Promise<{ quote: QuoteDto; created: boolean }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: quotes.id, createdByUserId: quotes.createdByUserId }).from(quotes).where(eq(quotes.id, input.id));
    if (existing) {
      if (existing.createdByUserId !== actor.id) throw new FinanceError(409, 'A quote with this id already exists');
      return { quote: (await getQuote(existing.id, tx))!, created: false };
    }
    await assertEventLink(tx, input.eventId);

    const at = nowIso();
    const { fields, lines } = pricedQuote(input);
    await tx.insert(quotes).values({
      id: input.id,
      quoteNumber: await nextDocumentNumber(tx, 'quote'),
      status: 'draft',
      ...fields,
      statusChangedAt: at,
      createdByUserId: actor.id,
      createdByEmail: actor.email,
      updatedByEmail: actor.email,
      createdAt: at,
      updatedAt: at,
    });
    await writeItems(tx, input.id, input, lines, at);
    await audit(tx, { entityId: input.id, action: 'create', actor, before: null, after: await snapshot(tx, input.id), at });
    return { quote: (await getQuote(input.id, tx))!, created: true };
  });
}

export async function updateQuote(id: string, input: QuoteUpdateInput, actor: Actor): Promise<QuoteDto> {
  return db.transaction(async (tx) => {
    const before = await snapshot(tx, id);
    if (!before || before.deletedAt) throw new FinanceError(404, 'Quote not found');
    if (before.updatedAt !== input.expectedUpdatedAt) throw new FinanceError(409, staleMessage, undefined, await getQuote(id, tx));
    if (!isQuoteEditable(before.status)) {
      throw new FinanceError(409, `${QUOTE_STATUS_LABELS[before.status]} quotes can't be edited.`);
    }
    await assertEventLink(tx, input.eventId, before.eventId);

    const at = nextTimestamp(before.updatedAt);
    const { fields, lines } = pricedQuote(input);
    const [updated] = await tx
      .update(quotes)
      .set({ ...fields, updatedByEmail: actor.email, updatedAt: at })
      .where(and(eq(quotes.id, id), eq(quotes.updatedAt, before.updatedAt)))
      .returning({ id: quotes.id });
    if (!updated) throw new FinanceError(409, staleMessage);
    await writeItems(tx, id, input, lines, at, before.items);
    await audit(tx, { entityId: id, action: 'update', actor, before, after: await snapshot(tx, id), at });
    return (await getQuote(id, tx))!;
  });
}

// Soft delete: the quote disappears from the app and its client link stops
// working (links only resolve to quotes that aren't deleted, and live ones
// are revoked here too). The row and its history stay in the database.
export async function deleteQuote(id: string, expectedUpdatedAt: string, actor: Actor): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await snapshot(tx, id);
    if (!before || before.deletedAt) throw new FinanceError(404, 'Quote not found');
    if (before.updatedAt !== expectedUpdatedAt) throw new FinanceError(409, staleMessage, undefined, await getQuote(id, tx));
    const invoiceRows = await tx.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.quoteId, id), isNull(invoices.deletedAt)));
    const blocker = quoteDeleteBlocker(before.status, invoiceRows.length);
    if (blocker) throw new FinanceError(409, blocker);

    const at = nextTimestamp(before.updatedAt);
    const [deleted] = await tx
      .update(quotes)
      .set({ deletedAt: at, updatedByEmail: actor.email, updatedAt: at })
      .where(and(eq(quotes.id, id), eq(quotes.updatedAt, before.updatedAt)))
      .returning({ id: quotes.id });
    if (!deleted) throw new FinanceError(409, staleMessage);
    await tx
      .update(quoteAccessLinks)
      .set({ revokedAt: at, revokedByEmail: actor.email })
      .where(and(eq(quoteAccessLinks.quoteId, id), isNull(quoteAccessLinks.revokedAt)));
    await audit(tx, { entityId: id, action: 'delete', actor, before, after: { ...before, deletedAt: at }, at });
  });
}

// Records an email the provider has accepted. Called only after a
// successful send; the first one for the quote is 'first', later ones
// 'resend'. Stores the recipient and who sent it — never the link or PDF.
export async function recordQuoteEmailSend(quoteId: string, send: { recipientEmail: string; providerMessageId: string | null }, actor: Actor): Promise<QuoteEmailSendKind> {
  return db.transaction(async (tx) => {
    const [earlier] = await tx.select({ id: quoteEmailSends.id }).from(quoteEmailSends).where(eq(quoteEmailSends.quoteId, quoteId)).limit(1);
    const kind: QuoteEmailSendKind = earlier ? 'resend' : 'first';
    await tx.insert(quoteEmailSends).values({
      quoteId,
      recipientEmail: send.recipientEmail,
      kind,
      sentByEmail: actor.email,
      providerMessageId: send.providerMessageId,
      sentAt: nowIso(),
    });
    return kind;
  });
}

// "YYYY-MM-DD" plus whole days, as a calendar date.
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// A new draft copied from a quote: same customer, event, items, pricing,
// notes and terms; dated `today` and valid for as many days as the original;
// a new number. `newId` comes from the browser so a retried request returns
// the same copy instead of making a second one.
export async function cloneQuote(id: string, newId: string, today: string, actor: Actor): Promise<QuoteDto> {
  const source = await getQuote(id);
  if (!source) throw new FinanceError(404, 'Quote not found');
  const validityDays = Math.max(0, Math.round((Date.parse(source.validUntil) - Date.parse(source.quoteDate)) / 86_400_000));
  const input: QuoteCreateInput = {
    id: newId,
    customerName: source.customerName,
    customerCompany: source.customerCompany,
    customerEmail: source.customerEmail,
    customerPhone: source.customerPhone,
    billingAddress: source.billingAddress,
    // A deleted booking can't be linked again; the event details are kept.
    eventId: source.eventDeleted ? null : source.eventId,
    eventName: source.eventName,
    eventDate: source.eventDate,
    venueName: source.venueName,
    venueAddress: source.venueAddress,
    quoteDate: today,
    validUntil: addDays(today, validityDays),
    items: source.items.map((i) => ({
      section: i.section,
      itemName: i.itemName,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      discountType: i.discountType,
      discountValue: i.discountValue,
    })),
    discountType: source.discountType,
    discountValue: source.discountValue,
    taxLabel: source.taxLabel,
    taxRateBp: source.taxRateBp,
    depositType: source.depositType,
    depositValue: source.depositValue,
    notes: source.notes,
    terms: source.terms,
    showPaymentDetails: source.showPaymentDetails,
    paymentMethod: source.paymentMethod,
  };
  return (await createQuote(input, actor)).quote;
}

// Manual status change (Phase 1 has no sending or client acceptance yet).
export async function setQuoteStatus(id: string, input: QuoteStatusInput, actor: Actor): Promise<QuoteDto> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(quotes).where(eq(quotes.id, id));
    if (!before || before.deletedAt) throw new FinanceError(404, 'Quote not found');
    if (before.updatedAt !== input.expectedUpdatedAt) throw new FinanceError(409, staleMessage, undefined, await getQuote(id, tx));
    if (before.status === input.status) return (await getQuote(id, tx))!;
    if (!canSetQuoteStatus(before.status, input.status)) {
      throw new FinanceError(409, `A ${QUOTE_STATUS_LABELS[before.status].toLowerCase()} quote can't be marked ${QUOTE_STATUS_LABELS[input.status].toLowerCase()}.`);
    }

    const at = nextTimestamp(before.updatedAt);
    const [after] = await tx
      .update(quotes)
      .set({
        status: input.status,
        statusChangedAt: at,
        // First time only: when it was first sent / accepted.
        sentAt: input.status === 'sent' ? (before.sentAt ?? at) : before.sentAt,
        acceptedAt: input.status === 'accepted' ? (before.acceptedAt ?? at) : before.acceptedAt,
        updatedByEmail: actor.email,
        updatedAt: at,
      })
      .where(and(eq(quotes.id, id), eq(quotes.updatedAt, before.updatedAt)))
      .returning();
    if (!after) throw new FinanceError(409, staleMessage);
    await audit(tx, { entityId: id, action: 'status', actor, before, after, at });
    return (await getQuote(id, tx))!;
  });
}
