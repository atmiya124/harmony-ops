// A partner's page and paying them back, against a throwaway local SQLite
// file with every migration applied (never the shared Turso database).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { splitMigration } from './migrationGuard';
import { expenseInputSchema, reimbursementInputSchema } from '../schemas/finance';

const dir = mkdtempSync(join(tmpdir(), 'harmony-partners-'));
const url = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;
process.env.PARTNER_EMAILS = 'ana@example.com,ben@example.com';

const TODAY = '2026-10-20';
const ana = { id: 'user-ana', email: 'ana@example.com' };
let client: Client;
let repo: typeof import('./financeRepo');

before(async () => {
  client = createClient({ url });
  await client.execute(
    "CREATE TABLE bookings (id integer PRIMARY KEY AUTOINCREMENT, event_title text NOT NULL, client_name text NOT NULL, client_phone text NOT NULL, client_email text NOT NULL, event_date text NOT NULL, setup_time text NOT NULL, start_time text NOT NULL, end_time text NOT NULL, venue_name text NOT NULL, venue_address text NOT NULL, event_type text NOT NULL, notes text, status text NOT NULL DEFAULT 'Tentative', created_by integer, created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT '', pickup_date text, pickup_time text)",
  );
  for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) await client.batch(splitMigration(readFileSync(join('drizzle', f), 'utf8')), 'write');
  repo = await import('./financeRepo');
});

after(() => {
  client?.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the file briefly; it's in the temp folder.
  }
});

async function expense(paidByEmail: string, amountCents: number, expenseDate: string, extra: Record<string, unknown> = {}) {
  const input = expenseInputSchema(TODAY).parse({
    id: randomUUID(),
    bookingId: null,
    category: 'transportation_fuel',
    amountCents,
    expenseDate,
    paidByEmail,
    paymentMethod: 'personal_card',
    ...extra,
  });
  return (await repo.createExpense(input, ana)).expense;
}

const payment = (amountCents: number, reimbursedOn = TODAY, id = randomUUID()) =>
  reimbursementInputSchema(TODAY).parse({ id, amountCents, reimbursedOn, method: 'etransfer', notes: 'Oct payback' });

test('a payment is applied to the oldest expenses first and shows as one payment', async () => {
  const older = await expense('ana@example.com', 30000, '2026-10-01');
  const newer = await expense('ana@example.com', 25000, '2026-10-05', { category: 'food' });
  await expense('ana@example.com', 9000, '2026-10-06', { paymentMethod: 'company_card' }); // company money: never owed
  await expense('ben@example.com', 5000, '2026-10-02'); // someone else's

  const before = (await repo.getPartnerSummary('ana@example.com'))!;
  assert.equal(before.spentCents, 64000);
  assert.equal(before.owedCents, 55000);
  assert.equal(before.expenseCount, 3);
  // Own money vs company money, and how it was paid.
  assert.equal(before.personalCents, 55000);
  assert.equal(before.companyCents, 9000);
  assert.deepEqual(before.byMethod, [
    { method: 'personal_card', cents: 55000 },
    { method: 'company_card', cents: 9000 },
  ]);

  const after = await repo.recordPartnerPayment('ana@example.com', payment(40000), ana);
  assert.equal(after.owedCents, 15000);
  assert.equal(after.reimbursedCents, 40000);
  // One recorded payment = one history row, split across the two expenses.
  assert.equal(after.payments.length, 1);
  assert.equal(after.payments[0].amountCents, 40000);
  assert.deepEqual(after.payments[0].parts.map((p) => [p.expenseId, p.amountCents]).sort(), [[newer.id, 10000], [older.id, 30000]].sort());

  // Ben's balance is untouched.
  assert.equal((await repo.getPartnerSummary('ben@example.com'))!.owedCents, 5000);
});

test('refuses more than is owed, payments dated before the expenses they would cover, and unknown partners', async () => {
  await expense('ben@example.com', 8000, '2026-10-15');
  // Ben is owed 5000 (Oct 2) + 8000 (Oct 15).
  await assert.rejects(repo.recordPartnerPayment('ben@example.com', payment(20000), ana), /Only \$130\.00 is owed/);
  await assert.rejects(repo.recordPartnerPayment('ben@example.com', payment(9000, '2026-10-10'), ana), /on or before 2026-10-10/);
  await assert.rejects(repo.recordPartnerPayment('nobody@example.com', payment(100), ana), /Partner not found/);
  assert.equal(await repo.getPartnerSummary('nobody@example.com'), null);
});

test('a retried payment is recorded once', async () => {
  const id = randomUUID();
  const first = await repo.recordPartnerPayment('ben@example.com', payment(13000, TODAY, id), ana);
  const retry = await repo.recordPartnerPayment('ben@example.com', payment(13000, TODAY, id), ana);
  assert.equal(first.owedCents, 0);
  assert.equal(retry.owedCents, 0);
  assert.equal(retry.payments.length, 1);
  const rows = await client.execute("SELECT count(*) AS n FROM reimbursements r JOIN expenses e ON e.id = r.expense_id WHERE e.paid_by_email = 'ben@example.com'");
  assert.equal(Number(rows.rows[0].n), 2); // one part per expense, not four
  await assert.rejects(repo.recordPartnerPayment('ben@example.com', payment(100), ana), /Nothing is owed/);
});
