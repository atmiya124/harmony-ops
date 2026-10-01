// Finance data access. Every write runs in a transaction together with its
// finance_audit_log entry, so a change is never saved without its history.
// Business rules that need the database (booking exists, reimbursements
// don't exceed the expense, optimistic locking) live here; field-level
// validation happens earlier in src/lib/schemas/finance.ts.
import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNull, lte, ne, or, type SQL } from 'drizzle-orm';
import { db } from './client';
import { attachments, authUser, bookings, expenses, financeAuditLog, reimbursements, type ExpenseRow, type ReimbursementRow } from './schema';
import { getPartnerEmails, normalizeEmail, partnerDisplayName } from '../auth/allowlist';
import { checkExpenseChangeAgainstPayments, checkNewReimbursement, reimbursementState, type ReimbursementState } from '../finance/reimbursement';
import type { AuditAction, AuditEntityType, ExpenseCategory } from '../finance/types';
import type { ExpenseInput, ExpenseUpdate, ReimbursementInput } from '../schemas/finance';
import { activeStorage, storageFor, type StorageProvider, type StoredFile } from '../storage/receipts';
import type { ReceiptFileType } from '../storage/fileType';

export interface Actor {
  id: string;
  email: string;
}

// A rule violation the caller should see as a 4xx, not a crash.
export class FinanceError extends Error {
  constructor(
    public status: 400 | 404 | 409 | 422,
    message: string,
    public fieldErrors?: Record<string, string[]>,
    public current?: unknown,
  ) {
    super(message);
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function nowIso(): string {
  return new Date().toISOString();
}

// updatedAt doubles as the optimistic-lock version, so it must change on
// every write even if two land in the same millisecond.
function nextTimestamp(previous: string): string {
  const now = nowIso();
  return now > previous ? now : new Date(new Date(previous).getTime() + 1).toISOString();
}

async function audit(
  tx: Tx,
  entry: { entityType: AuditEntityType; entityId: string; action: AuditAction; actor: Actor; before: unknown; after: unknown; at: string },
) {
  await tx.insert(financeAuditLog).values({
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

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

export interface PartnerInfo {
  email: string;
  name: string | null; // known once they've signed in with Google
  image: string | null;
}

export async function listPartners(): Promise<PartnerInfo[]> {
  const emails = [...getPartnerEmails()];
  if (emails.length === 0) return [];
  const users = await db.select({ email: authUser.email, name: authUser.name, image: authUser.image }).from(authUser).where(inArray(authUser.email, emails));
  const byEmail = new Map(users.map((u) => [normalizeEmail(u.email), u]));
  return emails
    .map((email) => ({ email, name: partnerDisplayName(email, byEmail.get(email)?.name), image: byEmail.get(email)?.image ?? null }))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface ExpenseDto {
  id: string;
  bookingId: number | null;
  booking: { id: number; title: string; eventDate: string } | null;
  bookingDeleted: boolean; // linked to a booking that no longer exists
  category: ExpenseCategory;
  amountCents: number;
  taxCents: number;
  currency: string;
  expenseDate: string;
  paidByEmail: string;
  paymentMethod: ExpenseRow['paymentMethod'];
  fundingSource: ExpenseRow['fundingSource'];
  reimbursable: boolean;
  reimbursement: ReimbursementState;
  // `filename` is the name it was uploaded with (photos are re-encoded and
  // uploaded as receipt.jpg); `uploadedAt` is when the file was stored.
  receipt: { id: string; contentType: string; sizeBytes: number; filename: string | null; uploadedAt: string } | null;
  notes: string | null;
  createdByEmail: string;
  updatedByEmail: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedByEmail: string | null;
}

export interface ReimbursementDto {
  id: string;
  amountCents: number;
  reimbursedOn: string;
  method: ReimbursementRow['method'];
  notes: string | null;
  recordedByEmail: string;
  createdAt: string;
  voidedAt: string | null;
  voidedByEmail: string | null;
  voidReason: string | null;
}

export interface AuditEntryDto {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  changedByEmail: string;
  changedAt: string;
  before: unknown;
  after: unknown;
}

export interface ExpenseDetailDto extends ExpenseDto {
  reimbursements: ReimbursementDto[];
  history: AuditEntryDto[];
}

function toReimbursementDto(r: ReimbursementRow): ReimbursementDto {
  return {
    id: r.id,
    amountCents: r.amountCents,
    reimbursedOn: r.reimbursedOn,
    method: r.method,
    notes: r.notes,
    recordedByEmail: r.recordedByEmail,
    createdAt: r.createdAt,
    voidedAt: r.voidedAt,
    voidedByEmail: r.voidedByEmail,
    voidReason: r.voidReason,
  };
}

// Loads everything the DTOs need for a set of expense rows in 3 queries.
async function hydrate(rows: ExpenseRow[], reader: Tx | typeof db = db): Promise<ExpenseDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const bookingIds = [...new Set(rows.map((r) => r.bookingId).filter((id): id is number => id !== null))];
  const attachmentIds = [...new Set(rows.map((r) => r.receiptAttachmentId).filter((id): id is string => id !== null))];

  const [payments, bookingRows, attachmentRows] = await Promise.all([
    reader.select().from(reimbursements).where(inArray(reimbursements.expenseId, ids)),
    bookingIds.length
      ? reader.select({ id: bookings.id, title: bookings.eventTitle, eventDate: bookings.eventDate }).from(bookings).where(inArray(bookings.id, bookingIds))
      : Promise.resolve([]),
    attachmentIds.length
      ? reader
          .select({
            id: attachments.id,
            contentType: attachments.contentType,
            sizeBytes: attachments.sizeBytes,
            filename: attachments.originalFilename,
            uploadedAt: attachments.createdAt,
          })
          .from(attachments)
          .where(and(inArray(attachments.id, attachmentIds), isNull(attachments.deletedAt)))
      : Promise.resolve([]),
  ]);

  const paymentsByExpense = new Map<string, ReimbursementRow[]>();
  for (const p of payments) paymentsByExpense.set(p.expenseId, [...(paymentsByExpense.get(p.expenseId) ?? []), p]);
  const bookingById = new Map(bookingRows.map((b) => [b.id, b]));
  const attachmentById = new Map(attachmentRows.map((a) => [a.id, a]));

  return rows.map((r) => {
    const booking = r.bookingId !== null ? bookingById.get(r.bookingId) : undefined;
    return {
      id: r.id,
      bookingId: r.bookingId,
      booking: booking ? { id: booking.id, title: booking.title || 'Untitled event', eventDate: booking.eventDate } : null,
      bookingDeleted: r.bookingId !== null && !booking,
      category: r.category,
      amountCents: r.amountCents,
      taxCents: r.taxCents,
      currency: r.currency,
      expenseDate: r.expenseDate,
      paidByEmail: r.paidByEmail,
      paymentMethod: r.paymentMethod,
      fundingSource: r.fundingSource,
      reimbursable: r.reimbursable,
      reimbursement: reimbursementState(r, paymentsByExpense.get(r.id) ?? []),
      receipt: r.receiptAttachmentId ? (attachmentById.get(r.receiptAttachmentId) ?? null) : null,
      notes: r.notes,
      createdByEmail: r.createdByEmail,
      updatedByEmail: r.updatedByEmail,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      deletedByEmail: r.deletedByEmail,
    };
  });
}

// ---------------------------------------------------------------------------
// Context checks shared by create and update
// ---------------------------------------------------------------------------

// On edits, `previous` is the stored record: values that aren't changing are
// accepted as-is, so an expense can still be corrected after its partner
// leaves PARTNER_EMAILS or Event-booking-app deletes its booking. Only a
// newly chosen partner or event has to be valid today.
async function assertExpenseContext(
  reader: Tx,
  input: { bookingId: number | null; paidByEmail: string; receiptAttachmentId: string | null },
  expenseId: string,
  previous?: ExpenseRow,
) {
  const paidByUnchanged = previous && normalizeEmail(previous.paidByEmail) === normalizeEmail(input.paidByEmail);
  if (!paidByUnchanged && !getPartnerEmails().has(normalizeEmail(input.paidByEmail))) {
    throw new FinanceError(422, 'Paid by must be one of the partners', { paidByEmail: ['Choose one of the four partners'] });
  }
  const bookingUnchanged = previous && previous.bookingId === input.bookingId;
  if (input.bookingId !== null && !bookingUnchanged) {
    const [booking] = await reader.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, input.bookingId));
    if (!booking) throw new FinanceError(422, 'That event no longer exists', { bookingId: ['Choose an existing event'] });
  }
  if (input.receiptAttachmentId) {
    const [attachment] = await reader
      .select({ id: attachments.id })
      .from(attachments)
      .where(and(eq(attachments.id, input.receiptAttachmentId), isNull(attachments.deletedAt)));
    if (!attachment) throw new FinanceError(422, 'Receipt not found — upload it again', { receiptAttachmentId: ['Upload the receipt again'] });
    const [usedBy] = await reader
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.receiptAttachmentId, input.receiptAttachmentId), ne(expenses.id, expenseId)));
    if (usedBy) throw new FinanceError(422, 'That receipt is already attached to another expense', { receiptAttachmentId: ['Already used'] });
  }
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export interface ExpenseFilter {
  from?: string;
  to?: string;
  bookingId?: number | 'general';
  paidByEmail?: string;
  category?: ExpenseCategory;
  includeDeleted?: boolean;
  limit?: number;
}

export async function listExpenses(filter: ExpenseFilter = {}): Promise<ExpenseDto[]> {
  const where: SQL[] = [];
  if (!filter.includeDeleted) where.push(isNull(expenses.deletedAt));
  if (filter.from) where.push(gte(expenses.expenseDate, filter.from));
  if (filter.to) where.push(lte(expenses.expenseDate, filter.to));
  if (filter.bookingId === 'general') where.push(isNull(expenses.bookingId));
  else if (filter.bookingId !== undefined) where.push(eq(expenses.bookingId, filter.bookingId));
  if (filter.paidByEmail) where.push(eq(expenses.paidByEmail, normalizeEmail(filter.paidByEmail)));
  if (filter.category) where.push(eq(expenses.category, filter.category));

  const rows = await db
    .select()
    .from(expenses)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
    .limit(Math.min(Math.max(filter.limit ?? 500, 1), 2000));
  return hydrate(rows);
}

export async function getExpenseDetail(id: string, reader: Tx | typeof db = db): Promise<ExpenseDetailDto | null> {
  const [row] = await reader.select().from(expenses).where(eq(expenses.id, id));
  if (!row) return null;
  const [dto] = await hydrate([row], reader);
  const payments = await reader.select().from(reimbursements).where(eq(reimbursements.expenseId, id)).orderBy(reimbursements.createdAt);
  const paymentIds = payments.map((p) => p.id);
  const historyRows = await reader
    .select()
    .from(financeAuditLog)
    .where(
      or(
        and(eq(financeAuditLog.entityType, 'expense'), eq(financeAuditLog.entityId, id)),
        paymentIds.length ? and(eq(financeAuditLog.entityType, 'reimbursement'), inArray(financeAuditLog.entityId, paymentIds)) : undefined,
      ),
    )
    .orderBy(financeAuditLog.id);
  return {
    ...dto,
    reimbursements: payments.map(toReimbursementDto),
    history: historyRows.map((h) => ({
      entityType: h.entityType,
      entityId: h.entityId,
      action: h.action,
      changedByEmail: h.changedByEmail,
      changedAt: h.changedAt,
      before: h.before ? JSON.parse(h.before) : null,
      after: h.after ? JSON.parse(h.after) : null,
    })),
  };
}

// Creates an expense, or — when the same partner retries with an id that
// already exists (a flaky connection re-sending the save) — returns the
// existing one instead of creating a duplicate.
export async function createExpense(input: ExpenseInput, actor: Actor): Promise<{ expense: ExpenseDetailDto; created: boolean }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(expenses).where(eq(expenses.id, input.id));
    if (existing) {
      if (existing.createdByUserId !== actor.id) throw new FinanceError(409, 'An expense with this id already exists');
      return { expense: (await getExpenseDetail(existing.id, tx))!, created: false };
    }
    await assertExpenseContext(tx, input, input.id);

    const at = nowIso();
    const [row] = await tx
      .insert(expenses)
      .values({
        id: input.id,
        bookingId: input.bookingId,
        category: input.category,
        amountCents: input.amountCents,
        taxCents: input.taxCents,
        expenseDate: input.expenseDate,
        paidByEmail: input.paidByEmail,
        paymentMethod: input.paymentMethod,
        fundingSource: input.fundingSource,
        reimbursable: input.reimbursable,
        receiptAttachmentId: input.receiptAttachmentId,
        notes: input.notes,
        createdByUserId: actor.id,
        createdByEmail: actor.email,
        updatedByEmail: actor.email,
        createdAt: at,
        updatedAt: at,
      })
      .returning();
    await audit(tx, { entityType: 'expense', entityId: row.id, action: 'create', actor, before: null, after: row, at });
    return { expense: (await getExpenseDetail(row.id, tx))!, created: true };
  });
}

export async function updateExpense(id: string, input: ExpenseUpdate, actor: Actor): Promise<ExpenseDetailDto> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(expenses).where(eq(expenses.id, id));
    if (!before) throw new FinanceError(404, 'Expense not found');
    if (before.deletedAt) throw new FinanceError(409, 'This expense was deleted. Restore it before editing.');
    if (before.updatedAt !== input.expectedUpdatedAt) {
      throw new FinanceError(409, 'Someone else changed this expense. Review their changes and try again.', undefined, await getExpenseDetail(id, tx));
    }
    await assertExpenseContext(tx, input, id, before);
    const payments = await tx.select().from(reimbursements).where(eq(reimbursements.expenseId, id));
    const check = checkExpenseChangeAgainstPayments(input, payments);
    if (!check.ok) throw new FinanceError(422, check.error);

    const at = nextTimestamp(before.updatedAt);
    const [after] = await tx
      .update(expenses)
      .set({
        bookingId: input.bookingId,
        category: input.category,
        amountCents: input.amountCents,
        taxCents: input.taxCents,
        expenseDate: input.expenseDate,
        paidByEmail: input.paidByEmail,
        paymentMethod: input.paymentMethod,
        fundingSource: input.fundingSource,
        reimbursable: input.reimbursable,
        receiptAttachmentId: input.receiptAttachmentId,
        notes: input.notes,
        updatedByEmail: actor.email,
        updatedAt: at,
      })
      .where(and(eq(expenses.id, id), eq(expenses.updatedAt, before.updatedAt)))
      .returning();
    if (!after) throw new FinanceError(409, 'Someone else changed this expense. Review their changes and try again.');
    await audit(tx, { entityType: 'expense', entityId: id, action: 'update', actor, before, after, at });
    return (await getExpenseDetail(id, tx))!;
  });
}

// Soft delete: the expense leaves every total but stays in the database and
// history, and can be restored (the "Undo" after an accidental save).
export async function deleteExpense(id: string, actor: Actor): Promise<ExpenseDetailDto> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(expenses).where(eq(expenses.id, id));
    if (!before) throw new FinanceError(404, 'Expense not found');
    if (before.deletedAt) return (await getExpenseDetail(id, tx))!; // already deleted: idempotent
    const payments = await tx.select().from(reimbursements).where(eq(reimbursements.expenseId, id));
    if (payments.some((p) => !p.voidedAt)) {
      throw new FinanceError(409, 'This expense has reimbursement payments. Void them before deleting it.');
    }
    const at = nextTimestamp(before.updatedAt);
    const [after] = await tx
      .update(expenses)
      .set({ deletedAt: at, deletedByEmail: actor.email, updatedAt: at, updatedByEmail: actor.email })
      .where(eq(expenses.id, id))
      .returning();
    await audit(tx, { entityType: 'expense', entityId: id, action: 'delete', actor, before, after, at });
    return (await getExpenseDetail(id, tx))!;
  });
}

export async function restoreExpense(id: string, actor: Actor): Promise<ExpenseDetailDto> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(expenses).where(eq(expenses.id, id));
    if (!before) throw new FinanceError(404, 'Expense not found');
    if (!before.deletedAt) return (await getExpenseDetail(id, tx))!;
    const at = nextTimestamp(before.updatedAt);
    const [after] = await tx
      .update(expenses)
      .set({ deletedAt: null, deletedByEmail: null, updatedAt: at, updatedByEmail: actor.email })
      .where(eq(expenses.id, id))
      .returning();
    await audit(tx, { entityType: 'expense', entityId: id, action: 'restore', actor, before, after, at });
    return (await getExpenseDetail(id, tx))!;
  });
}

// ---------------------------------------------------------------------------
// Reimbursements (partial payments back to a partner)
// ---------------------------------------------------------------------------

export async function addReimbursement(expenseId: string, input: ReimbursementInput, actor: Actor): Promise<ExpenseDetailDto> {
  return db.transaction(async (tx) => {
    const [expense] = await tx.select().from(expenses).where(eq(expenses.id, expenseId));
    if (!expense) throw new FinanceError(404, 'Expense not found');

    const [existing] = await tx.select().from(reimbursements).where(eq(reimbursements.id, input.id));
    if (existing) {
      // Retried save of the same payment: return the current state, don't pay twice.
      if (existing.expenseId === expenseId && existing.recordedByUserId === actor.id) return (await getExpenseDetail(expenseId, tx))!;
      throw new FinanceError(409, 'A reimbursement with this id already exists');
    }

    // Read the payments inside the write transaction, so two partners
    // recording at the same moment can't together exceed the expense.
    const payments = await tx.select().from(reimbursements).where(eq(reimbursements.expenseId, expenseId));
    const check = checkNewReimbursement(expense, payments, input.amountCents);
    if (!check.ok) throw new FinanceError(422, check.error, { amountCents: [check.error] });
    if (input.reimbursedOn < expense.expenseDate) {
      throw new FinanceError(422, "A reimbursement can't be dated before the expense", { reimbursedOn: [`Use ${expense.expenseDate} or later`] });
    }

    const at = nowIso();
    const [row] = await tx
      .insert(reimbursements)
      .values({
        id: input.id,
        expenseId,
        amountCents: input.amountCents,
        reimbursedOn: input.reimbursedOn,
        method: input.method,
        notes: input.notes,
        recordedByUserId: actor.id,
        recordedByEmail: actor.email,
        createdAt: at,
      })
      .returning();
    await audit(tx, { entityType: 'reimbursement', entityId: row.id, action: 'create', actor, before: null, after: row, at });
    return (await getExpenseDetail(expenseId, tx))!;
  });
}

// Corrects a mistaken payment without erasing it: it stops counting towards
// the balance but stays in the history with who voided it and why.
export async function voidReimbursement(expenseId: string, reimbursementId: string, reason: string, actor: Actor): Promise<ExpenseDetailDto> {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(reimbursements)
      .where(and(eq(reimbursements.id, reimbursementId), eq(reimbursements.expenseId, expenseId)));
    if (!before) throw new FinanceError(404, 'Reimbursement not found');
    if (before.voidedAt) return (await getExpenseDetail(expenseId, tx))!;
    const at = nowIso();
    const [after] = await tx
      .update(reimbursements)
      .set({ voidedAt: at, voidedByEmail: actor.email, voidReason: reason })
      .where(eq(reimbursements.id, reimbursementId))
      .returning();
    await audit(tx, { entityType: 'reimbursement', entityId: reimbursementId, action: 'void', actor, before, after, at });
    return (await getExpenseDetail(expenseId, tx))!;
  });
}

// What each partner is currently owed, across all expenses.
export async function outstandingReimbursements(): Promise<{ paidByEmail: string; outstandingCents: number }[]> {
  const rows = await db.select().from(expenses).where(and(isNull(expenses.deletedAt), eq(expenses.reimbursable, true)));
  const dtos = await hydrate(rows);
  const totals = new Map<string, number>();
  for (const e of dtos) {
    if (e.reimbursement.outstandingCents > 0) totals.set(e.paidByEmail, (totals.get(e.paidByEmail) ?? 0) + e.reimbursement.outstandingCents);
  }
  return [...totals.entries()].map(([paidByEmail, outstandingCents]) => ({ paidByEmail, outstandingCents }));
}

// ---------------------------------------------------------------------------
// Receipt attachments
// ---------------------------------------------------------------------------

export interface AttachmentDto {
  id: string;
  contentType: string;
  sizeBytes: number;
  // Same file already attached to another (non-deleted) expense — a strong
  // hint the partner is about to record a duplicate.
  duplicateOfExpenseId: string | null;
}

export async function createAttachment(
  file: { bytes: Uint8Array; type: ReceiptFileType; originalFilename: string | null },
  actor: Actor,
): Promise<AttachmentDto> {
  const id = randomUUID();
  const sha256 = createHash('sha256').update(file.bytes).digest('hex');
  const at = nowIso();
  // Random, unguessable key; no names, amounts or emails in it.
  const key = `receipts/${at.slice(0, 4)}/${at.slice(5, 7)}/${id}.${file.type.extension}`;
  const storage = activeStorage();
  // Stored before the database row: if the insert below fails, an
  // unreferenced file is left in private storage — never exposed, and
  // harmless — rather than a row pointing at a file that doesn't exist.
  await storage.put(key, file.bytes, file.type.contentType);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(attachments)
      .values({
        id,
        storageProvider: storage.provider,
        storageKey: key,
        contentType: file.type.contentType,
        sizeBytes: file.bytes.byteLength,
        sha256,
        originalFilename: file.originalFilename?.slice(0, 200) ?? null,
        uploadedByUserId: actor.id,
        uploadedByEmail: actor.email,
        createdAt: at,
      })
      .returning();
    await audit(tx, { entityType: 'attachment', entityId: id, action: 'create', actor, before: null, after: row, at });

    const [duplicate] = await tx
      .select({ expenseId: expenses.id })
      .from(expenses)
      .innerJoin(attachments, eq(expenses.receiptAttachmentId, attachments.id))
      .where(and(eq(attachments.sha256, sha256), ne(attachments.id, id), isNull(expenses.deletedAt)))
      .limit(1);
    return { id, contentType: row.contentType, sizeBytes: row.sizeBytes, duplicateOfExpenseId: duplicate?.expenseId ?? null };
  });
}

export async function openAttachment(id: string): Promise<{ contentType: string; sizeBytes: number; extension: string; file: StoredFile } | null> {
  const [row] = await db.select().from(attachments).where(and(eq(attachments.id, id), isNull(attachments.deletedAt)));
  if (!row) return null;
  const file = await storageFor(row.storageProvider as StorageProvider).get(row.storageKey);
  if (!file) return null;
  return { contentType: row.contentType, sizeBytes: row.sizeBytes, extension: row.storageKey.split('.').pop() ?? 'bin', file };
}
