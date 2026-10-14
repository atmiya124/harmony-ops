// Runs the real quote repository against a throwaway local SQLite file with
// every migration applied — never the shared Turso database.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { splitMigration } from './migrationGuard';
import type { QuoteCreateInput } from '../schemas/quote';
import { quoteCreateSchema } from '../schemas/quote';

const dir = mkdtempSync(join(tmpdir(), 'harmony-quotes-'));
const url = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;

let client: Client;
let repo: typeof import('./quoteRepo');
const actor = { id: 'user-1', email: 'partner@example.com' };

before(async () => {
  client = createClient({ url });
  // `bookings` belongs to Event-booking-app, so no migration creates it.
  await client.execute(`CREATE TABLE bookings (
    id integer PRIMARY KEY AUTOINCREMENT, event_title text NOT NULL, client_name text NOT NULL, client_phone text NOT NULL,
    client_email text NOT NULL, event_date text NOT NULL, setup_time text NOT NULL, start_time text NOT NULL, end_time text NOT NULL,
    venue_name text NOT NULL, venue_address text NOT NULL, event_type text NOT NULL, notes text, status text NOT NULL DEFAULT 'Tentative',
    created_by integer, created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT '', pickup_date text, pickup_time text)`);
  await client.execute(
    `INSERT INTO bookings (id, event_title, client_name, client_phone, client_email, event_date, setup_time, start_time, end_time, venue_name, venue_address, event_type)
     VALUES (7, 'Smith Gala', 'Michael Smith', '555', 'm@example.com', '2026-11-20', '', '', '', 'Hall', '1 Main St', 'Corporate')`,
  );
  const migrations = readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) await client.batch(splitMigration(readFileSync(join('drizzle', file), 'utf8')), 'write');
  repo = await import('./quoteRepo');
});

after(() => {
  client?.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the file briefly; it's in the temp folder.
  }
});

function omitId<T extends { id: unknown }>(value: T): Omit<T, 'id'> {
  const copy: Partial<T> = { ...value };
  delete copy.id;
  return copy as Omit<T, 'id'>;
}

function input(overrides: Partial<Record<keyof QuoteCreateInput, unknown>> = {}): QuoteCreateInput {
  return quoteCreateSchema.parse({
    id: randomUUID(),
    customerName: 'Michael Smith',
    customerEmail: 'michael@example.com',
    eventId: null,
    eventDate: null,
    quoteDate: '2026-10-13',
    validUntil: '2026-11-12',
    items: [
      { section: 'LED Display', itemName: 'Outdoor LED Wall P3.9', quantity: 1, unitPriceCents: 240000 },
      { section: 'Sound', itemName: 'Wireless Microphones', quantity: 6, unitPriceCents: 6000 },
    ],
    discountType: 'percent',
    discountValue: 500,
    taxLabel: 'HST',
    taxRateBp: 1300,
    depositType: 'percent',
    depositValue: 5000,
    ...overrides,
  });
}

test('creates a draft with server-calculated totals and the first number', async () => {
  const { quote, created } = await repo.createQuote(input(), actor);
  assert.equal(created, true);
  assert.equal(quote.quoteNumber, 'Q-000000001');
  assert.equal(quote.status, 'draft');
  assert.equal(quote.subtotalCents, 276000);
  assert.equal(quote.discountCents, 13800);
  assert.equal(quote.taxCents, 34086); // 13% of 262,200
  assert.equal(quote.totalCents, 296286);
  assert.equal(quote.depositRequiredCents, 148143);
  assert.deepEqual(
    quote.items.map((i) => [i.section, i.lineTotalCents, i.sortOrder]),
    [
      ['LED Display', 240000, 0],
      ['Sound', 36000, 1],
    ],
  );
});

test('totals smuggled into the request body are ignored', async () => {
  const raw = { ...input(), id: randomUUID(), totalCents: 1, subtotalCents: 1, quoteNumber: 'Q-000000999', status: 'accepted' };
  const { quote } = await repo.createQuote(quoteCreateSchema.parse(raw), actor);
  assert.equal(quote.totalCents, 296286);
  assert.notEqual(quote.quoteNumber, 'Q-000000999');
  assert.equal(quote.status, 'draft');
});

test('a retried save returns the same quote instead of a duplicate', async () => {
  const data = input();
  const first = await repo.createQuote(data, actor);
  const retry = await repo.createQuote(data, actor);
  assert.equal(retry.created, false);
  assert.equal(retry.quote.quoteNumber, first.quote.quoteNumber);
});

test('the database refuses a duplicate number even if the app slipped', async () => {
  const [q] = await repo.listQuotes();
  await assert.rejects(
    client.execute({
      sql: `INSERT INTO quotes (id, quote_number, customer_name, quote_date, valid_until, subtotal_cents, tax_rate_bp, tax_cents, total_cents, created_by_user_id, created_by_email, updated_by_email, created_at, updated_at)
            VALUES (?, ?, 'X', '2026-10-13', '2026-10-13', 0, 0, 0, 0, 'u', 'e', 'e', 'now', 'now')`,
      args: [randomUUID(), q.quoteNumber],
    }),
  );
});

test('the database refuses totals that do not add up', async () => {
  await assert.rejects(
    client.execute({
      sql: `INSERT INTO quotes (id, quote_number, customer_name, quote_date, valid_until, subtotal_cents, tax_rate_bp, tax_cents, total_cents, created_by_user_id, created_by_email, updated_by_email, created_at, updated_at)
            VALUES (?, 'Q-900000000', 'X', '2026-10-13', '2026-10-13', 100, 0, 0, 1, 'u', 'e', 'e', 'now', 'now')`,
      args: [randomUUID()],
    }),
  );
});

test('edits recalculate, keep item ids, and refuse stale versions', async () => {
  const { quote } = await repo.createQuote(input(), actor);
  const fields = omitId(input());
  const keptId = quote.items[0].id;
  const updated = await repo.updateQuote(
    quote.id,
    {
      ...fields,
      items: [
        { ...fields.items[0], id: keptId, quantity: 2 },
        { section: 'Services', itemName: 'Crew', description: null, quantity: 1, unitPriceCents: 90000, discountType: 'none', discountValue: 0 },
      ],
      discountType: 'fixed',
      discountValue: 10000,
      depositType: 'none',
      depositValue: 0,
      expectedUpdatedAt: quote.updatedAt,
    },
    actor,
  );
  assert.equal(updated.quoteNumber, quote.quoteNumber);
  assert.equal(updated.subtotalCents, 570000);
  assert.equal(updated.discountCents, 10000);
  assert.equal(updated.taxCents, 72800);
  assert.equal(updated.totalCents, 632800);
  assert.equal(updated.depositRequiredCents, 0);
  assert.equal(updated.items[0].id, keptId);
  assert.equal(updated.items[1].section, 'Services');

  await assert.rejects(repo.updateQuote(quote.id, { ...fields, expectedUpdatedAt: quote.updatedAt }, actor), (e: { status?: number }) => e.status === 409);
});

test('item discounts are stored per line and come off before the subtotal', async () => {
  const { quote } = await repo.createQuote(
    input({
      items: [
        { section: 'LED Display', itemName: 'Outdoor LED Wall', quantity: 1, unitPriceCents: 240000, discountType: 'percent', discountValue: 1000 },
        { section: 'Sound', itemName: 'Mics', quantity: 6, unitPriceCents: 6000, discountType: 'fixed', discountValue: 6000 },
        { section: 'Sound', itemName: 'PA', quantity: 1, unitPriceCents: 50000 }, // discount omitted = none
      ],
    }),
    actor,
  );
  assert.deepEqual(
    quote.items.map((i) => [i.lineTotalCents, i.discountType, i.discountCents, i.netTotalCents]),
    [
      [240000, 'percent', 24000, 216000],
      [36000, 'fixed', 6000, 30000],
      [50000, 'none', 0, 50000],
    ],
  );
  assert.equal(quote.itemDiscountsCents, 30000);
  assert.equal(quote.subtotalCents, 296000);
  assert.equal(quote.discountCents, 14800); // the quote's own 5%, on the discounted subtotal
  assert.equal(quote.taxCents, 36556); // 13% of $2,812.00
  assert.equal(quote.totalCents, 317756);

  // A fixed item discount bigger than its line is refused before saving.
  const bad = quoteCreateSchema.safeParse({
    ...input(),
    items: [{ section: 'A', itemName: 'B', quantity: 1, unitPriceCents: 1000, discountType: 'fixed', discountValue: 1001 }],
  });
  assert.equal(bad.success, false);
  assert.deepEqual(bad.error!.issues.map((i) => i.path.join('.')), ['items.0.discountValue']);

  // The database itself refuses an item discount larger than the line.
  await assert.rejects(client.execute({ sql: 'UPDATE quote_items SET discount_type = ?, discount_value = ?, discount_cents = ? WHERE quote_id = ? AND sort_order = 2', args: ['fixed', 99999, 99999, quote.id] }));
});

test('payment details on the PDF: on by default, can be switched off and back', async () => {
  const { quote } = await repo.createQuote(input(), actor);
  assert.equal(quote.showPaymentDetails, true);
  const off = await repo.updateQuote(quote.id, { ...omitId(input()), showPaymentDetails: false, expectedUpdatedAt: quote.updatedAt }, actor);
  assert.equal(off.showPaymentDetails, false);
  assert.equal((await repo.getQuote(quote.id))!.showPaymentDetails, false);
  const { quote: hidden } = await repo.createQuote(input({ showPaymentDetails: false }), actor);
  assert.equal(hidden.showPaymentDetails, false);
});

test('event links must exist when chosen; the snapshot is kept', async () => {
  await assert.rejects(repo.createQuote(input({ eventId: 999 }), actor), (e: { status?: number }) => e.status === 422);
  const { quote } = await repo.createQuote(input({ eventId: 7, eventName: 'Smith Gala', eventDate: '2026-11-20', venueName: 'Hall' }), actor);
  assert.equal(quote.event?.id, 7);
  assert.equal(quote.eventDeleted, false);
  assert.equal(quote.venueName, 'Hall');

  await client.execute('DELETE FROM bookings WHERE id = 7');
  const reloaded = (await repo.getQuote(quote.id))!;
  assert.equal(reloaded.event, null);
  assert.equal(reloaded.eventDeleted, true);
  assert.equal(reloaded.eventName, 'Smith Gala');
  // Still editable without re-picking an event.
  const fields = omitId(input({ eventId: 7, eventName: 'Smith Gala' }));
  await repo.updateQuote(quote.id, { ...fields, expectedUpdatedAt: reloaded.updatedAt }, actor);
});

test('status changes: accepted quotes lock, converted can not be set by hand', async () => {
  const { quote } = await repo.createQuote(input(), actor);
  const sent = await repo.setQuoteStatus(quote.id, { status: 'sent', expectedUpdatedAt: quote.updatedAt }, actor);
  assert.equal(sent.status, 'sent');
  assert.ok(sent.sentAt);
  const accepted = await repo.setQuoteStatus(quote.id, { status: 'accepted', expectedUpdatedAt: sent.updatedAt }, actor);
  assert.ok(accepted.acceptedAt);
  const fields = omitId(input());
  await assert.rejects(repo.updateQuote(quote.id, { ...fields, expectedUpdatedAt: accepted.updatedAt }, actor), (e: { status?: number }) => e.status === 409);

  const history = await client.execute({ sql: 'SELECT action FROM sales_audit_log WHERE entity_id = ? ORDER BY id', args: [quote.id] });
  assert.deepEqual(
    history.rows.map((r) => r.action),
    ['create', 'status', 'status'],
  );
});

test('defaults fall back to 13% HST when finance settings are empty', async () => {
  const d = await repo.getQuoteDefaults();
  assert.equal(d.taxRateBp, 1300);
  await client.execute('INSERT INTO finance_settings (id, default_hst_rate_bp) VALUES (1, 1500)');
  assert.equal((await repo.getQuoteDefaults()).taxRateBp, 1500);
});

// Last: a local SQLite file fails competing writers fast (SQLITE_BUSY) and
// the local driver can leave the file locked afterwards. Turso queues write
// transactions instead. Either way a save gets a unique number or fails
// cleanly — two saves never share one.
test('delete: soft, hidden from reads, stale versions and accepted quotes refused', async () => {
  const { quote } = await repo.createQuote(input(), actor);
  await assert.rejects(repo.deleteQuote(quote.id, 'old-version', actor), (e: { status?: number }) => e.status === 409);
  await repo.deleteQuote(quote.id, quote.updatedAt, actor);
  assert.equal(await repo.getQuote(quote.id), null);
  assert.ok(!(await repo.listQuotes()).some((q) => q.id === quote.id));
  const row = await client.execute({ sql: 'SELECT deleted_at FROM quotes WHERE id = ?', args: [quote.id] });
  assert.ok(row.rows[0].deleted_at, 'the row is kept, marked deleted');
  const history = await client.execute({ sql: 'SELECT action FROM sales_audit_log WHERE entity_id = ? ORDER BY id', args: [quote.id] });
  assert.deepEqual(history.rows.map((r) => r.action), ['create', 'delete']);
  await assert.rejects(repo.deleteQuote(quote.id, quote.updatedAt, actor), (e: { status?: number }) => e.status === 404);

  const { quote: other } = await repo.createQuote(input(), actor);
  const accepted = await repo.setQuoteStatus(other.id, { status: 'accepted', expectedUpdatedAt: other.updatedAt }, actor);
  await assert.rejects(repo.deleteQuote(other.id, accepted.updatedAt, actor), /Accepted quotes can't be deleted/);
});

test('clone: a new draft with a new number, today’s date, the same validity, items and pricing', async () => {
  const { quote } = await repo.createQuote(input({ notes: 'Load-in at 2', eventDate: '2026-12-01' }), actor);
  const sent = await repo.setQuoteStatus(quote.id, { status: 'sent', expectedUpdatedAt: quote.updatedAt }, actor);
  const newId = randomUUID();
  const copy = await repo.cloneQuote(sent.id, newId, '2026-10-20', actor);
  assert.equal(copy.id, newId);
  assert.notEqual(copy.quoteNumber, quote.quoteNumber);
  assert.equal(copy.status, 'draft');
  assert.equal(copy.quoteDate, '2026-10-20');
  assert.equal(copy.validUntil, '2026-11-19'); // 30 days, as on the original
  assert.equal(copy.totalCents, quote.totalCents);
  assert.equal(copy.notes, 'Load-in at 2');
  assert.equal(copy.eventDate, '2026-12-01');
  assert.deepEqual(
    copy.items.map((i) => [i.section, i.itemName, i.quantity, i.unitPriceCents]),
    quote.items.map((i) => [i.section, i.itemName, i.quantity, i.unitPriceCents]),
  );
  assert.ok(copy.items.every((i) => !quote.items.some((o) => o.id === i.id)), 'items are new rows');
  // A retried clone returns the same copy.
  assert.equal((await repo.cloneQuote(sent.id, newId, '2026-10-20', actor)).quoteNumber, copy.quoteNumber);
  // The original is untouched.
  assert.equal((await repo.getQuote(quote.id))!.status, 'sent');
});

// Last: the deliberate lock contention leaves the local SQLite file busy for a moment.
test('concurrent saves never share a quote number', async () => {
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => repo.createQuote(input(), actor)));
  const numbers = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.quote.quoteNumber] : []));
  assert.ok(numbers.length >= 1);
  assert.equal(new Set(numbers).size, numbers.length);
  const all = await client.execute('SELECT quote_number FROM quotes ORDER BY quote_number DESC');
  const stored = all.rows.map((r) => String(r.quote_number));
  assert.equal(new Set(stored).size, stored.length);
});
