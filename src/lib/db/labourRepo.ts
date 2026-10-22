// Hourly crew labour and the crew directory. An event's labour is one
// `labour` expense row (amount = what the crew earned) with a line per
// person; each payment to a person is its own `labour_payment` expense row
// (see EXPENSE_KINDS). Every write runs in a transaction with its
// finance_audit_log entry, like the rest of Finance.
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from './client';
import { bookings, crewMembers, expenseLabourLines, expenses, type CrewMemberRow, type ExpenseLabourLineRow, type ExpenseRow } from './schema';
import { audit, FinanceError, livePaidByLine, nextTimestamp, nowIso, type Actor, type Tx } from './financeRepo';
import { getPartnerEmails, normalizeEmail } from '../auth/allowlist';
import { checkLabourEdit, checkLabourPayment, labourPayState, lineAmountCents, totalPayState, type LabourPayState } from '../finance/labour';
import { isCalendarDate, type CrewMemberCreate, type CrewMemberUpdate, type LabourPaymentInput, type LabourSaveInput } from '../schemas/finance';
import type { FundingSource, PaymentMethod } from '../finance/types';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface LabourPaymentDto {
  id: string; // the payment's expense id (its details page)
  amountCents: number;
  paidOn: string;
  paidByEmail: string;
  paymentMethod: PaymentMethod;
  fundingSource: FundingSource;
  reference: string | null;
  notes: string | null;
  createdByEmail: string;
  createdAt: string;
}

export interface LabourLineDto extends LabourPayState {
  id: string;
  crewMemberId: string | null; // null = a one-off person
  workerName: string;
  role: string | null;
  minutes: number;
  rateCents: number;
  payments: LabourPaymentDto[]; // live payments, oldest first
}

export interface EventLabourDto {
  expenseId: string;
  bookingId: number | null;
  booking: { id: number; title: string; eventDate: string } | null;
  expenseDate: string;
  updatedAt: string;
  deletedAt: string | null;
  lines: LabourLineDto[];
  totals: { people: number; minutes: number } & LabourPayState;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

async function toEventLabour(reader: Tx | typeof db, row: ExpenseRow): Promise<EventLabourDto> {
  const lines = await reader.select().from(expenseLabourLines).where(eq(expenseLabourLines.expenseId, row.id)).orderBy(asc(expenseLabourLines.position));
  const paymentRows = lines.length
    ? await reader
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.kind, 'labour_payment'),
            isNull(expenses.deletedAt),
            inArray(
              expenses.labourLineId,
              lines.map((l) => l.id),
            ),
          ),
        )
        .orderBy(asc(expenses.expenseDate), asc(expenses.createdAt))
    : [];
  const [booking] =
    row.bookingId !== null
      ? await reader.select({ id: bookings.id, title: bookings.eventTitle, eventDate: bookings.eventDate }).from(bookings).where(eq(bookings.id, row.bookingId))
      : [];

  const lineDtos = lines.map((l): LabourLineDto => {
    const payments = paymentRows.filter((p) => p.labourLineId === l.id);
    return {
      id: l.id,
      crewMemberId: l.crewMemberId,
      workerName: l.workerName,
      role: l.role,
      minutes: l.minutes,
      rateCents: l.rateCents,
      ...labourPayState(l.amountCents, payments),
      payments: payments.map((p) => ({
        id: p.id,
        amountCents: p.amountCents,
        paidOn: p.expenseDate,
        paidByEmail: p.paidByEmail,
        paymentMethod: p.paymentMethod,
        fundingSource: p.fundingSource,
        reference: p.reference,
        notes: p.notes,
        createdByEmail: p.createdByEmail,
        createdAt: p.createdAt,
      })),
    };
  });
  return {
    expenseId: row.id,
    bookingId: row.bookingId,
    booking: booking ? { id: booking.id, title: booking.title || 'Untitled event', eventDate: booking.eventDate } : null,
    expenseDate: row.expenseDate,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    lines: lineDtos,
    totals: { people: lineDtos.length, minutes: lineDtos.reduce((s, l) => s + l.minutes, 0), ...totalPayState(lineDtos) },
  };
}

export async function getLabour(expenseId: string, reader: Tx | typeof db = db): Promise<EventLabourDto | null> {
  const [row] = await reader.select().from(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.kind, 'labour')));
  return row ? toEventLabour(reader, row) : null;
}

async function liveLabourRow(reader: Tx | typeof db, bookingId: number): Promise<ExpenseRow | undefined> {
  const [row] = await reader
    .select()
    .from(expenses)
    .where(and(eq(expenses.kind, 'labour'), eq(expenses.bookingId, bookingId), isNull(expenses.deletedAt)));
  return row;
}

// The event's live crew labour, or null when none has been entered.
export async function getEventLabour(bookingId: number, reader: Tx | typeof db = db): Promise<EventLabourDto | null> {
  const row = await liveLabourRow(reader, bookingId);
  return row ? toEventLabour(reader, row) : null;
}

// ---------------------------------------------------------------------------
// Entering hours
// ---------------------------------------------------------------------------

// Labour is dated on the event (a cost of that event), or today when the
// event is still ahead — expense dates are never in the future.
function labourDate(eventDate: string | undefined, today: string): string {
  return eventDate && isCalendarDate(eventDate) && eventDate <= today ? eventDate : today;
}

const lineSnapshot = (l: ExpenseLabourLineRow) => ({
  id: l.id,
  crewMemberId: l.crewMemberId,
  workerName: l.workerName,
  role: l.role,
  minutes: l.minutes,
  rateCents: l.rateCents,
  amountCents: l.amountCents,
});

// Saves an event's crew hours: creates its labour on first save, otherwise
// replaces the set of lines (existing ids are updated in place so their
// payments stay attached). No payment details here — those come later.
export async function saveEventLabour(bookingId: number, input: LabourSaveInput, actor: Actor, today: string): Promise<EventLabourDto> {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select({ id: bookings.id, eventDate: bookings.eventDate }).from(bookings).where(eq(bookings.id, bookingId));
    let row = await liveLabourRow(tx, bookingId);
    if (!row && !booking) throw new FinanceError(404, 'Event not found');
    if (row && row.updatedAt !== input.expectedUpdatedAt) {
      throw new FinanceError(409, 'Someone else changed this labour. Review their changes and try again.', undefined, await toEventLabour(tx, row));
    }
    if (!row && input.expectedUpdatedAt !== null) throw new FinanceError(409, 'This labour was removed. Reload and enter it again.');

    const crewIds = [...new Set(input.lines.map((l) => l.crewMemberId).filter((id): id is string => id !== null))];
    if (crewIds.length) {
      const found = await tx.select({ id: crewMembers.id }).from(crewMembers).where(inArray(crewMembers.id, crewIds));
      if (found.length !== crewIds.length) throw new FinanceError(422, 'A crew member was not found. Pick them again.');
    }

    const existing = row ? await tx.select().from(expenseLabourLines).where(eq(expenseLabourLines.expenseId, row.id)) : [];
    const existingIds = new Set(existing.map((l) => l.id));
    // Ids are client-generated: one from another event's labour is refused.
    const taken = await tx
      .select({ id: expenseLabourLines.id })
      .from(expenseLabourLines)
      .where(
        inArray(
          expenseLabourLines.id,
          input.lines.map((l) => l.id),
        ),
      );
    if (taken.some((t) => !existingIds.has(t.id))) throw new FinanceError(409, 'This labour changed elsewhere. Reload and try again.');

    const paid = await livePaidByLine(
      tx,
      existing.map((l) => l.id),
    );
    const edit = checkLabourEdit(
      existing.map((l) => ({ id: l.id, workerName: l.workerName, paidCents: paid.get(l.id) ?? 0 })),
      input.lines,
    );
    if (!edit.ok) throw new FinanceError(422, edit.error);

    const lines = input.lines.map((l, position) => ({ ...l, position, amountCents: lineAmountCents(l.minutes, l.rateCents) }));
    const totalCents = lines.reduce((s, l) => s + l.amountCents, 0);
    if (totalCents <= 0) throw new FinanceError(422, 'The total must be more than $0');

    let at: string;
    let before: unknown = null;
    if (row) {
      before = { ...row, lines: existing.map(lineSnapshot) };
      at = nextTimestamp(row.updatedAt);
      [row] = await tx
        .update(expenses)
        .set({ amountCents: totalCents, updatedByEmail: actor.email, updatedAt: at })
        .where(and(eq(expenses.id, row.id), eq(expenses.updatedAt, row.updatedAt)))
        .returning();
      if (!row) throw new FinanceError(409, 'Someone else changed this labour. Review their changes and try again.');
    } else {
      at = nowIso();
      [row] = await tx
        .insert(expenses)
        .values({
          id: randomUUID(),
          kind: 'labour',
          bookingId,
          category: 'crew',
          amountCents: totalCents,
          taxCents: 0, // contract labour: no HST is added
          expenseDate: labourDate(booking?.eventDate, today),
          // Not a payment: these only record who entered it, and keep it out
          // of every partner's spend and reimbursement.
          paidByEmail: normalizeEmail(actor.email),
          paymentMethod: 'company_card',
          fundingSource: 'company',
          reimbursable: false,
          createdByUserId: actor.id,
          createdByEmail: actor.email,
          updatedByEmail: actor.email,
          createdAt: at,
          updatedAt: at,
        })
        .returning();
    }
    const labourId = row.id;

    const keep = new Set(lines.map((l) => l.id));
    const removed = existing.filter((l) => !keep.has(l.id)).map((l) => l.id);
    if (removed.length) await tx.delete(expenseLabourLines).where(inArray(expenseLabourLines.id, removed));
    for (const l of lines) {
      const values = { crewMemberId: l.crewMemberId, position: l.position, workerName: l.workerName, role: l.role, minutes: l.minutes, rateCents: l.rateCents, amountCents: l.amountCents };
      if (existingIds.has(l.id)) await tx.update(expenseLabourLines).set({ ...values, updatedAt: at }).where(eq(expenseLabourLines.id, l.id));
      else await tx.insert(expenseLabourLines).values({ id: l.id, expenseId: labourId, ...values, createdAt: at, updatedAt: at });
    }

    const after = { ...row, lines: lines.map((l) => ({ id: l.id, crewMemberId: l.crewMemberId, workerName: l.workerName, role: l.role, minutes: l.minutes, rateCents: l.rateCents, amountCents: l.amountCents })) };
    await audit(tx, { entityType: 'expense', entityId: labourId, action: before ? 'update' : 'create', actor, before, after, at });
    return toEventLabour(tx, row);
  });
}

// ---------------------------------------------------------------------------
// Paying crew
// ---------------------------------------------------------------------------

// Records money paid to one crew person against their hours. It's a crew
// expense of its own (who paid, how, whose money), so a partner who paid
// from their own pocket is owed it back through the usual reimbursements.
export async function recordLabourPayment(lineId: string, input: LabourPaymentInput, actor: Actor): Promise<EventLabourDto> {
  return db.transaction(async (tx) => {
    const [line] = await tx.select().from(expenseLabourLines).where(eq(expenseLabourLines.id, lineId));
    if (!line) throw new FinanceError(404, 'Crew hours not found');
    const [labour] = await tx.select().from(expenses).where(eq(expenses.id, line.expenseId));
    if (!labour || labour.deletedAt) throw new FinanceError(409, 'This labour was removed');

    // Retried request: the payment is already there, so don't pay twice.
    const [existing] = await tx.select().from(expenses).where(eq(expenses.id, input.id));
    if (existing) {
      if (existing.createdByUserId === actor.id && existing.labourLineId === lineId) return toEventLabour(tx, labour);
      throw new FinanceError(409, 'A payment with this id already exists');
    }

    if (!getPartnerEmails().has(normalizeEmail(input.paidByEmail))) {
      throw new FinanceError(422, 'Paid by must be one of the partners', { paidByEmail: ['Choose one of the partners'] });
    }
    const state = labourPayState(line.amountCents, [{ amountCents: (await livePaidByLine(tx, [line.id])).get(line.id) ?? 0 }]);
    const check = checkLabourPayment(state, input.amountCents);
    if (!check.ok) throw new FinanceError(422, check.error, { amountCents: [check.error] });

    const at = nowIso();
    const [row] = await tx
      .insert(expenses)
      .values({
        id: input.id,
        kind: 'labour_payment',
        labourLineId: line.id,
        bookingId: labour.bookingId,
        category: 'crew',
        amountCents: input.amountCents,
        taxCents: 0,
        expenseDate: input.paidOn,
        paidByEmail: input.paidByEmail,
        paymentMethod: input.paymentMethod,
        fundingSource: input.fundingSource,
        reimbursable: input.reimbursable,
        reference: input.reference,
        notes: input.notes,
        createdByUserId: actor.id,
        createdByEmail: actor.email,
        updatedByEmail: actor.email,
        createdAt: at,
        updatedAt: at,
      })
      .returning();
    await audit(tx, { entityType: 'expense', entityId: row.id, action: 'create', actor, before: null, after: row, at });
    return toEventLabour(tx, labour);
  });
}

// ---------------------------------------------------------------------------
// Crew directory
// ---------------------------------------------------------------------------

export interface CrewWorkDto extends LabourPayState {
  lineId: string;
  labourExpenseId: string;
  booking: { id: number; title: string; eventDate: string } | null;
  workedOn: string; // the labour's date
  workerName: string; // as entered for this event
  role: string | null;
  minutes: number;
  rateCents: number;
}

export interface CrewTotals extends LabourPayState {
  events: number;
  minutes: number;
  lastWorkedOn: string | null;
}

export interface CrewMemberDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  company: string | null;
  defaultRateCents: number | null;
  notes: string | null;
  active: boolean;
  updatedAt: string;
  totals: CrewTotals;
}

export interface CrewMemberDetailDto extends CrewMemberDto {
  work: CrewWorkDto[]; // newest first
}

// Every live labour line worked by these crew members — every profile
// ('all'), or the one-off people with no profile ('one-off') — with what
// was paid.
async function workFor(reader: Tx | typeof db, crewIds: string[] | 'all' | 'one-off'): Promise<(CrewWorkDto & { crewMemberId: string | null })[]> {
  const rows = await reader
    .select({ line: expenseLabourLines, labour: { id: expenses.id, bookingId: expenses.bookingId, expenseDate: expenses.expenseDate } })
    .from(expenseLabourLines)
    .innerJoin(expenses, eq(expenses.id, expenseLabourLines.expenseId))
    .where(
      and(
        isNull(expenses.deletedAt),
        crewIds === 'all'
          ? isNotNull(expenseLabourLines.crewMemberId)
          : crewIds === 'one-off'
            ? isNull(expenseLabourLines.crewMemberId)
            : inArray(expenseLabourLines.crewMemberId, crewIds.length ? crewIds : ['']),
      ),
    )
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
  const paid = await livePaidByLine(
    reader,
    rows.map((r) => r.line.id),
  );
  const bookingIds = [...new Set(rows.map((r) => r.labour.bookingId).filter((id): id is number => id !== null))];
  const bookingRows = bookingIds.length
    ? await reader.select({ id: bookings.id, title: bookings.eventTitle, eventDate: bookings.eventDate }).from(bookings).where(inArray(bookings.id, bookingIds))
    : [];
  const bookingById = new Map(bookingRows.map((b) => [b.id, { id: b.id, title: b.title || 'Untitled event', eventDate: b.eventDate }]));
  return rows.map(({ line, labour }) => ({
    crewMemberId: line.crewMemberId,
    lineId: line.id,
    labourExpenseId: labour.id,
    booking: labour.bookingId !== null ? (bookingById.get(labour.bookingId) ?? null) : null,
    workedOn: labour.expenseDate,
    workerName: line.workerName,
    role: line.role,
    minutes: line.minutes,
    rateCents: line.rateCents,
    ...labourPayState(line.amountCents, [{ amountCents: paid.get(line.id) ?? 0 }]),
  }));
}

function totalsOf(work: CrewWorkDto[]): CrewTotals {
  return {
    events: new Set(work.map((w) => w.labourExpenseId)).size,
    minutes: work.reduce((s, w) => s + w.minutes, 0),
    lastWorkedOn: work.reduce<string | null>((max, w) => (max === null || w.workedOn > max ? w.workedOn : max), null),
    ...totalPayState(work),
  };
}

function toCrewDto(m: CrewMemberRow, work: CrewWorkDto[]): CrewMemberDto {
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    email: m.email,
    role: m.role,
    company: m.company,
    defaultRateCents: m.defaultRateCents,
    notes: m.notes,
    active: m.active,
    updatedAt: m.updatedAt,
    totals: totalsOf(work),
  };
}

export async function listCrew(): Promise<CrewMemberDto[]> {
  const [members, work] = await Promise.all([db.select().from(crewMembers).orderBy(asc(crewMembers.name)), workFor(db, 'all')]);
  return members.map((m) =>
    toCrewDto(
      m,
      work.filter((w) => w.crewMemberId === m.id),
    ),
  );
}

// One-off people (typed in on an event, not on the crew list) who are still
// owed money, oldest first — so Owed to crew covers everyone, not only
// profiles.
export async function unpaidOneOffs(): Promise<CrewWorkDto[]> {
  return (await workFor(db, 'one-off')).filter((w) => w.remainingCents > 0).reverse();
}

export async function getCrewMember(id: string, reader: Tx | typeof db = db): Promise<CrewMemberDetailDto | null> {
  const [m] = await reader.select().from(crewMembers).where(eq(crewMembers.id, id));
  if (!m) return null;
  const work: CrewWorkDto[] = await workFor(reader, [id]);
  return { ...toCrewDto(m, work), work };
}

// Creates a profile, or returns it when a flaky connection retries the save.
export async function createCrewMember(input: CrewMemberCreate, actor: Actor): Promise<CrewMemberDetailDto> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(crewMembers).where(eq(crewMembers.id, input.id));
    if (!existing) {
      const at = nowIso();
      const { id, ...fields } = input;
      await tx.insert(crewMembers).values({ id, ...fields, createdByEmail: actor.email, updatedByEmail: actor.email, createdAt: at, updatedAt: at });
    }
    return (await getCrewMember(input.id, tx))!;
  });
}

// Profile edits never touch past labour: each line kept its own name, role
// and rate when it was entered.
export async function updateCrewMember(id: string, input: CrewMemberUpdate, actor: Actor): Promise<CrewMemberDetailDto> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(crewMembers).where(eq(crewMembers.id, id));
    if (!before) throw new FinanceError(404, 'Crew member not found');
    if (before.updatedAt !== input.expectedUpdatedAt) {
      throw new FinanceError(409, 'Someone else changed this profile. Review their changes and try again.', undefined, await getCrewMember(id, tx));
    }
    const { name, phone, email, role, company, defaultRateCents, notes, active } = input;
    await tx
      .update(crewMembers)
      .set({ name, phone, email, role, company, defaultRateCents, notes, active, updatedByEmail: actor.email, updatedAt: nextTimestamp(before.updatedAt) })
      .where(eq(crewMembers.id, id));
    return (await getCrewMember(id, tx))!;
  });
}
