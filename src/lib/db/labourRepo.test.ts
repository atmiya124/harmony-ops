// Hourly crew labour, payments and the crew directory, against a throwaway
// local SQLite file with every migration applied (never the shared Turso
// database).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { splitMigration } from './migrationGuard';
import { crewMemberCreateSchema, crewMemberUpdateSchema, expenseInputSchema, labourPaymentSchema, labourSaveSchema, reimbursementInputSchema } from '../schemas/finance';
import { countsAsCost, countsAsOutlay } from '../finance/labour';
import { summarizeEvent } from '../finance/profit';

const dir = mkdtempSync(join(tmpdir(), 'harmony-labour-'));
const url = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;
process.env.PARTNER_EMAILS = 'ana@example.com,ben@example.com';

const TODAY = '2026-10-20';
const ana = { id: 'user-ana', email: 'ana@example.com' };
let client: Client;
let finance: typeof import('./financeRepo');
let labour: typeof import('./labourRepo');

before(async () => {
  client = createClient({ url });
  await client.execute(
    "CREATE TABLE bookings (id integer PRIMARY KEY AUTOINCREMENT, event_title text NOT NULL, client_name text NOT NULL, client_phone text NOT NULL, client_email text NOT NULL, event_date text NOT NULL, setup_time text NOT NULL, start_time text NOT NULL, end_time text NOT NULL, venue_name text NOT NULL, venue_address text NOT NULL, event_type text NOT NULL, notes text, status text NOT NULL DEFAULT 'Tentative', created_by integer, created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT '', pickup_date text, pickup_time text)",
  );
  for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) await client.batch(splitMigration(readFileSync(join('drizzle', f), 'utf8')), 'write');
  finance = await import('./financeRepo');
  labour = await import('./labourRepo');
});

after(() => {
  client?.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the file briefly; it's in the temp folder.
  }
});

async function booking(title: string, eventDate = '2026-10-10'): Promise<number> {
  const r = await client.execute({
    sql: "INSERT INTO bookings (event_title, client_name, client_phone, client_email, event_date, setup_time, start_time, end_time, venue_name, venue_address, event_type) VALUES (?, 'C', '', '', ?, '', '', '', '', '', 'Wedding')",
    args: [title, eventDate],
  });
  return Number(r.lastInsertRowid);
}

type Line = { id?: string; crewMemberId?: string | null; workerName: string; role?: string | null; minutes: number; rateCents: number };
const line = (l: Line) => ({ id: l.id ?? randomUUID(), crewMemberId: l.crewMemberId ?? null, workerName: l.workerName, role: l.role ?? null, minutes: l.minutes, rateCents: l.rateCents });

function save(bookingId: number, lines: ReturnType<typeof line>[], expectedUpdatedAt: string | null) {
  return labour.saveEventLabour(bookingId, labourSaveSchema.parse({ lines, expectedUpdatedAt }), ana, TODAY);
}

function pay(lineId: string, amountCents: number, extra: Record<string, unknown> = {}) {
  const input = labourPaymentSchema(TODAY).parse({
    id: randomUUID(),
    amountCents,
    paidOn: '2026-10-15',
    paidByEmail: 'ana@example.com',
    paymentMethod: 'company_card',
    ...extra,
  });
  return labour.recordLabourPayment(lineId, input, ana);
}

async function crew(name: string, defaultRateCents: number | null = null) {
  return labour.createCrewMember(crewMemberCreateSchema.parse({ id: randomUUID(), name, defaultRateCents }), ana);
}

const costOf = (rows: { kind: 'expense' | 'labour' | 'labour_payment'; amountCents: number }[]) => rows.filter(countsAsCost).reduce((s, e) => s + e.amountCents, 0);

test('hours are a cost straight away, before anyone is paid', async () => {
  const b = await booking('Gala');
  const mike = line({ workerName: 'Mike', minutes: 480, rateCents: 2500 });
  const sam = line({ workerName: 'Sam', minutes: 390, rateCents: 2200 });
  const saved = await save(b, [mike, sam], null);

  assert.equal(saved.totals.earnedCents, 20000 + 14300);
  assert.equal(saved.totals.paidCents, 0);
  assert.equal(saved.totals.remainingCents, 34300);
  assert.equal(saved.totals.status, 'unpaid');
  assert.deepEqual(
    saved.lines.map((l) => [l.workerName, l.earnedCents, l.status]),
    [
      ['Mike', 20000, 'unpaid'],
      ['Sam', 14300, 'unpaid'],
    ],
  );

  // One Crew row on the event, counted as cost, labelled compactly.
  const rows = await finance.listExpenses({ bookingId: b });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'labour');
  assert.equal(rows[0].category, 'crew');
  assert.equal(rows[0].taxCents, 0); // no HST added
  assert.equal(rows[0].expenseDate, '2026-10-10'); // dated on the event
  assert.deepEqual(rows[0].labour, { people: 2, minutes: 870, earnedCents: 34300, paidCents: 0, remainingCents: 34300, status: 'unpaid' });
  assert.equal(rows[0].reimbursement.status, 'not_required');
  assert.equal(costOf(rows), 34300);

  // Unpaid labour lowers the event's estimated profit.
  const summary = summarizeEvent({ agreedAmountCents: 100000, amountStatus: 'confirmed', hstTreatment: 'excluded', hstRateBp: 1300 }, rows, false);
  assert.equal(summary.estimatedProfitCents, 100000 - 34300);
});

test('partial, multiple and full payments; status is derived', async () => {
  const b = await booking('Wedding');
  const mike = line({ workerName: 'Mike', minutes: 480, rateCents: 2500 }); // $200
  await save(b, [mike], null);

  let l = (await pay(mike.id, 5000)).lines[0];
  assert.deepEqual([l.paidCents, l.remainingCents, l.status], [5000, 15000, 'partial']);
  l = (await pay(mike.id, 10000, { paymentMethod: 'etransfer', fundingSource: 'company', reference: 'ET-1234' })).lines[0];
  assert.deepEqual([l.paidCents, l.remainingCents, l.status], [15000, 5000, 'partial']);
  l = (await pay(mike.id, 5000)).lines[0];
  assert.deepEqual([l.paidCents, l.remainingCents, l.status], [20000, 0, 'paid']);
  assert.equal(l.payments.length, 3);
  assert.equal(l.payments[1].reference, 'ET-1234');

  // Can't pay more than earned.
  await assert.rejects(pay(mike.id, 1), /Nothing is owed/);

  // Payments are money out, not extra cost: the event still costs $200.
  const all = await finance.listExpenses({ bookingId: b });
  assert.equal(all.length, 4);
  assert.equal(costOf(all), 20000);
  assert.equal((await finance.listExpenses({ bookingId: b, view: 'cost' })).length, 1);
  assert.equal((await finance.listExpenses({ bookingId: b, view: 'outlay' })).length, 3);
  assert.equal(all.find((e) => e.kind === 'labour')?.labour?.status, 'paid');
  // Paying crew doesn't change the event's profit either.
  const agreed = { agreedAmountCents: 100000, amountStatus: 'confirmed' as const, hstTreatment: 'excluded' as const, hstRateBp: 1300 };
  assert.equal(summarizeEvent(agreed, all, false).estimatedProfitCents, 80000);
});

test('overpaying in one go is refused', async () => {
  const b = await booking('Concert');
  const mike = line({ workerName: 'Mike', minutes: 120, rateCents: 2500 }); // $50
  await save(b, [mike], null);
  await assert.rejects(pay(mike.id, 5001), /Only \$50\.00 is owed/);
});

test('extra hours after full payment leave the new hours owing; old payments untouched', async () => {
  const b = await booking('Festival');
  const mike = line({ workerName: 'Mike', minutes: 480, rateCents: 2500 }); // 8 h = $200
  const first = await save(b, [mike], null);
  const paidDto = await pay(mike.id, 20000);
  const payment = paidDto.lines[0].payments[0];
  assert.equal(paidDto.lines[0].status, 'paid');

  // Two more hours: 10 h × $25 = $250.
  const updated = await save(b, [{ ...mike, minutes: 600 }], paidDto.updatedAt);
  const l = updated.lines[0];
  assert.equal(l.id, mike.id); // same line, so its payment stays attached
  assert.deepEqual([l.earnedCents, l.paidCents, l.remainingCents, l.status], [25000, 20000, 5000, 'partial']);
  assert.deepEqual(l.payments, [payment]); // history unchanged
  assert.equal(updated.expenseId, first.expenseId);

  const row = (await finance.listExpenses({ bookingId: b, view: 'cost' }))[0];
  assert.equal(row.amountCents, 25000); // cost follows hours
  assert.equal(row.labour?.remainingCents, 5000);
});

test("hours can't drop below what was paid, and a paid person can't be removed", async () => {
  const b = await booking('Gala 2');
  const mike = line({ workerName: 'Mike', minutes: 480, rateCents: 2500 });
  const sam = line({ workerName: 'Sam', minutes: 60, rateCents: 2000 });
  await save(b, [mike, sam], null);
  const dto = await pay(mike.id, 15000);

  await assert.rejects(save(b, [{ ...mike, minutes: 300 }, sam], dto.updatedAt), /already been paid \$150\.00/);
  await assert.rejects(save(b, [sam], dto.updatedAt), /Mike has been paid \$150\.00, so they can't be removed/);
  // An unpaid person can be removed.
  const after = await save(b, [mike], dto.updatedAt);
  assert.deepEqual(
    after.lines.map((l) => l.workerName),
    ['Mike'],
  );
  // A stale editor is refused rather than overwriting.
  await assert.rejects(save(b, [mike, sam], dto.updatedAt), /Someone else changed this labour/);
});

test('removing a payment puts the amount back as owed; restore is guarded', async () => {
  const b = await booking('Expo');
  const mike = line({ workerName: 'Mike', minutes: 240, rateCents: 2500 }); // $100
  await save(b, [mike], null);
  const p1 = (await pay(mike.id, 10000)).lines[0].payments[0];
  await finance.deleteExpense(p1.id, ana);
  let l = (await labour.getEventLabour(b))!.lines[0];
  assert.deepEqual([l.paidCents, l.status], [0, 'unpaid']);
  // Paid again in the meantime: restoring the old payment would overpay.
  await pay(mike.id, 10000);
  await assert.rejects(finance.restoreExpense(p1.id, ana), /can't be restored/);
  l = (await labour.getEventLabour(b))!.lines[0];
  assert.equal(l.paidCents, 10000);
  // The labour itself can't be deleted while crew are paid.
  await assert.rejects(finance.deleteExpense((await labour.getEventLabour(b))!.expenseId, ana), /Remove their payments/);
});

test('labour and payments are not editable as plain expenses', async () => {
  const b = await booking('Launch');
  const mike = line({ workerName: 'Mike', minutes: 60, rateCents: 3000 });
  const dto = await pay((await save(b, [mike], null)).lines[0].id, 1000);
  const update = (id: string, updatedAt: string) =>
    finance.updateExpense(
      id,
      {
        bookingId: b,
        category: 'crew',
        amountCents: 1,
        taxCents: 0,
        expenseDate: TODAY,
        paidByEmail: 'ana@example.com',
        paymentMethod: 'cash',
        fundingSource: 'company',
        reimbursable: false,
        notes: null,
        receiptAttachmentId: null,
        expectedUpdatedAt: updatedAt,
      },
      ana,
    );
  await assert.rejects(update(dto.expenseId, dto.updatedAt), /labour screen/);
  const payment = await finance.getExpenseDetail(dto.lines[0].payments[0].id);
  await assert.rejects(update(payment!.id, payment!.updatedAt), /can't be edited/);
});

test('a partner who pays crew from their own pocket is owed it back — once', async () => {
  const b = await booking('Party');
  const jay = line({ workerName: 'Jay', minutes: 300, rateCents: 2000 }); // $100
  await save(b, [jay], null);
  await pay(jay.id, 6000, { paidByEmail: 'ben@example.com', paymentMethod: 'cash', fundingSource: 'personal' });

  const owed = await finance.outstandingReimbursements();
  assert.equal(owed.find((o) => o.paidByEmail === 'ben@example.com')?.outstandingCents, 6000);
  const ben = await finance.getPartnerSummary('ben@example.com');
  assert.equal(ben?.spentCents, 6000);
  assert.equal(ben?.owedCents, 6000);
  // Ana entered the hours, but labour isn't her spending: her page counts
  // only real money (here, the company-card crew payments she made).
  const anaOutlay = await finance.listExpenses({ paidByEmail: 'ana@example.com', view: 'outlay' });
  assert.equal(anaOutlay.filter((e) => e.kind === 'labour').length, 0);
  assert.equal((await finance.getPartnerSummary('ana@example.com'))?.spentCents, anaOutlay.reduce((s, e) => s + e.amountCents, 0));

  // Paying Ben back goes through the usual partner payment.
  const repaid = await finance.recordPartnerPayment('ben@example.com', reimbursementInputSchema(TODAY).parse({ id: randomUUID(), amountCents: 6000, reimbursedOn: TODAY, method: 'etransfer' }), ana);
  assert.equal(repaid.owedCents, 0);
  // Event cost is still exactly what Jay earned.
  assert.equal(costOf(await finance.listExpenses({ bookingId: b })), 10000);
  // And the payment rows count as outlay, the labour row as cost only.
  const rows = await finance.listExpenses({ bookingId: b });
  assert.deepEqual(rows.filter(countsAsOutlay).map((e) => e.kind), ['labour_payment']);
});

test('crew profiles: default rate is a default, labour keeps its own snapshot', async () => {
  const mikeProfile = await crew('Mike R.', 2500);
  const b1 = await booking('Event A', '2026-09-01');
  const a = line({ crewMemberId: mikeProfile.id, workerName: 'Mike R.', role: 'LED Tech', minutes: 480, rateCents: mikeProfile.defaultRateCents! });
  await save(b1, [a], null);

  const raised = await labour.updateCrewMember(
    mikeProfile.id,
    crewMemberUpdateSchema.parse({ name: 'Michael R.', defaultRateCents: 3000, role: 'Lead Tech', phone: '416-555-0100', expectedUpdatedAt: mikeProfile.updatedAt }),
    ana,
  );
  assert.equal(raised.defaultRateCents, 3000);

  // Event A keeps $25/h and the name/role used then.
  const eventA = (await labour.getEventLabour(b1))!.lines[0];
  assert.deepEqual([eventA.workerName, eventA.role, eventA.rateCents, eventA.earnedCents], ['Mike R.', 'LED Tech', 2500, 20000]);

  // A later event uses the new default.
  const b2 = await booking('Event B', '2026-10-05');
  const bLine = line({ crewMemberId: mikeProfile.id, workerName: raised.name, minutes: 240, rateCents: raised.defaultRateCents! });
  await save(b2, [bLine], null);
  await pay(bLine.id, 5000);

  // Work history: both events, newest first, with earned / paid / owed.
  const profile = (await labour.getCrewMember(mikeProfile.id))!;
  assert.deepEqual(
    profile.work.map((w) => [w.booking?.title, w.rateCents, w.earnedCents, w.paidCents, w.status]),
    [
      ['Event B', 3000, 12000, 5000, 'partial'],
      ['Event A', 2500, 20000, 0, 'unpaid'],
    ],
  );
  assert.deepEqual(
    { events: profile.totals.events, minutes: profile.totals.minutes, earned: profile.totals.earnedCents, paid: profile.totals.paidCents, owed: profile.totals.remainingCents, last: profile.totals.lastWorkedOn },
    { events: 2, minutes: 720, earned: 32000, paid: 5000, owed: 27000, last: '2026-10-05' },
  );
  assert.equal((await labour.listCrew()).find((c) => c.id === mikeProfile.id)?.totals.remainingCents, 27000);
});

test('one-off people work without a profile and stay out of the directory', async () => {
  const b = await booking('Small gig');
  const oneOff = line({ workerName: 'Cousin Dave', minutes: 180, rateCents: 2000 });
  const dto = await save(b, [oneOff], null);
  assert.equal(dto.lines[0].crewMemberId, null);
  assert.ok(!(await labour.listCrew()).some((c) => c.name === 'Cousin Dave'));
  // …but while they're owed, they're listed under Owed to crew.
  let owed = (await labour.unpaidOneOffs()).find((w) => w.workerName === 'Cousin Dave');
  assert.deepEqual([owed?.booking?.title, owed?.remainingCents, owed?.status], ['Small gig', 6000, 'unpaid']);
  await pay(oneOff.id, 2500);
  owed = (await labour.unpaidOneOffs()).find((w) => w.workerName === 'Cousin Dave');
  assert.deepEqual([owed?.remainingCents, owed?.status], [3500, 'partial']);
  await pay(oneOff.id, 3500);
  assert.ok(!(await labour.unpaidOneOffs()).some((w) => w.workerName === 'Cousin Dave')); // paid: off the list
  const latest = (await labour.getEventLabour(b))!;
  // An unknown profile id is refused.
  await assert.rejects(save(b, [{ ...oneOff, crewMemberId: randomUUID() }], latest.updatedAt), /crew member was not found/);
});

test('arbitrary hours: no shifts, minimums or overtime', async () => {
  const b = await booking('Odd hours');
  const lines = [
    line({ workerName: 'A', minutes: 180, rateCents: 2000 }), // 3
    line({ workerName: 'B', minutes: 390, rateCents: 2000 }), // 6.5 / 6:30
    line({ workerName: 'C', minutes: 705, rateCents: 2000 }), // 11:45
    line({ workerName: 'D', minutes: 14 * 60, rateCents: 2000 }), // long day, same rate
  ];
  const dto = await save(b, lines, null);
  assert.deepEqual(
    dto.lines.map((l) => l.earnedCents),
    [6000, 13000, 23500, 28000],
  );
});

test('the server works out the totals; a client total is never trusted', async () => {
  // labourSaveSchema has no amount field at all; the lines decide.
  const parsed = labourSaveSchema.parse({ expectedUpdatedAt: null, lines: [{ ...line({ workerName: 'A', minutes: 60, rateCents: 2000 }), amountCents: 1 }] });
  assert.ok(!('amountCents' in parsed.lines[0]));
  const b = await booking('Totals');
  const dto = await save(b, parsed.lines, null);
  assert.equal(dto.totals.earnedCents, 2000);
});

test('one live labour record per event', async () => {
  const b = await booking('Single');
  const first = await save(b, [line({ workerName: 'A', minutes: 60, rateCents: 2000 })], null);
  // A second "first entry" from another phone is refused rather than duplicated.
  await assert.rejects(save(b, [line({ workerName: 'B', minutes: 60, rateCents: 2000 })], null), /Someone else changed this labour/);
  await finance.deleteExpense(first.expenseId, ana);
  const second = await save(b, [line({ workerName: 'B', minutes: 60, rateCents: 2000 })], null);
  await assert.rejects(finance.restoreExpense(first.expenseId, ana), /already has crew labour/);
  assert.notEqual(second.expenseId, first.expenseId);
});

test('old lump-sum Crew expenses still work as plain expenses', async () => {
  const b = await booking('Old style');
  const input = expenseInputSchema(TODAY).parse({
    id: randomUUID(),
    bookingId: b,
    category: 'crew',
    amountCents: 30000,
    expenseDate: '2026-10-01',
    paidByEmail: 'ana@example.com',
    paymentMethod: 'personal_card',
  });
  const { expense } = await finance.createExpense(input, ana);
  assert.equal(expense.kind, 'expense');
  assert.equal(expense.labour, null);
  assert.equal(expense.reimbursement.status, 'pending');
  const rows = await finance.listExpenses({ bookingId: b, view: 'cost' });
  assert.equal(costOf(rows), 30000);
});
