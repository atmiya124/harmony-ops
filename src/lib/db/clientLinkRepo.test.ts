// Client quote links against a throwaway local SQLite file (never Turso).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { splitMigration } from './migrationGuard';
import { quoteCreateSchema } from '../schemas/quote';
import { quoteAcceptInputSchema, quoteDeclineInputSchema } from '../schemas/clientQuote';
import { generateLinkToken, hashLinkToken } from '../sales/clientLinkToken';

const dir = mkdtempSync(join(tmpdir(), 'harmony-links-'));
const url = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;
process.env.BETTER_AUTH_SECRET ??= 'test-secret-for-client-links';

let client: Client;
let repo: typeof import('./quoteRepo');
let links: typeof import('./clientLinkRepo');
let booking: typeof import('./quoteBooking');
const staff = { id: 'user-1', email: 'partner@example.com' };
const TODAY = '2026-10-13';
const meta = { ipAddress: '203.0.113.7', userAgent: 'TestBrowser/1.0' };

before(async () => {
  client = createClient({ url });
  await client.execute(
    "CREATE TABLE bookings (id integer PRIMARY KEY AUTOINCREMENT, event_title text NOT NULL, client_name text NOT NULL, client_phone text NOT NULL, client_email text NOT NULL, event_date text NOT NULL, setup_time text NOT NULL, start_time text NOT NULL, end_time text NOT NULL, venue_name text NOT NULL, venue_address text NOT NULL, event_type text NOT NULL, notes text, status text NOT NULL DEFAULT 'Tentative', created_by integer, created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT '', pickup_date text, pickup_time text)",
  );
  await client.execute('CREATE TABLE booking_equipment (id integer PRIMARY KEY AUTOINCREMENT, booking_id integer NOT NULL REFERENCES bookings(id) ON DELETE CASCADE, item_name text NOT NULL, spec text, qty integer NOT NULL DEFAULT 1, sort_order integer NOT NULL DEFAULT 0)');
  for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) await client.batch(splitMigration(readFileSync(join('drizzle', f), 'utf8')), 'write');
  repo = await import('./quoteRepo');
  links = await import('./clientLinkRepo');
  booking = await import('./quoteBooking');
});

after(() => {
  client?.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may hold the file briefly; it's in the temp folder.
  }
});

async function newQuote(validUntil = '2026-11-12') {
  const { quote } = await repo.createQuote(
    quoteCreateSchema.parse({
      id: randomUUID(),
      customerName: 'Daniel Smith',
      customerEmail: 'daniel@example.com',
      eventId: null,
      eventName: 'Gala',
      eventDate: '2026-11-20',
      quoteDate: '2026-10-01',
      validUntil,
      items: [{ section: 'Sound', itemName: 'PA', quantity: 1, unitPriceCents: 100000 }],
      discountType: 'none',
      discountValue: 0,
      taxLabel: 'HST',
      taxRateBp: 1300,
      depositType: 'percent',
      depositValue: 5000,
      notes: 'Load-in from the rear door.',
      terms: 'Term one.\nTerm two.',
    }),
    staff,
  );
  return quote;
}

const tokenOf = (path: string | null) => path!.replace('/q/', '');

const accept = (version: string, signature: unknown = { type: 'typed', value: 'Daniel Smith' }) =>
  quoteAcceptInputSchema.parse({ version, customerName: '  Daniel   Smith ', customerTitle: 'Director', acceptedTerms: true, signature });

test('creating a link: unguessable token, only its hash stored, draft becomes sent', async () => {
  const quote = await newQuote();
  assert.equal(quote.status, 'draft');
  const link = await links.createClientLink(quote.id, staff);
  const token = tokenOf(link.path);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);

  const rows = await client.execute({ sql: 'SELECT token_hash, token_encrypted FROM quote_access_links WHERE quote_id = ?', args: [quote.id] });
  assert.equal(rows.rows[0].token_hash, hashLinkToken(token));
  assert.ok(!String(rows.rows[0].token_encrypted).includes(token), 'token is not stored in plain text');
  // The raw token never appears in any log.
  const logs = await client.execute('SELECT * FROM quote_activity UNION ALL SELECT 0, entity_id, action, changed_by_user_id, changed_by_email, NULL, before || after, changed_at FROM sales_audit_log');
  assert.ok(!JSON.stringify(logs.rows).includes(token));

  assert.equal((await repo.getQuote(quote.id))!.status, 'sent');
  const staffView = await links.getStaffClientLink(quote.id);
  assert.equal(staffView.link!.path, link.path); // staff can copy it again
});

test('lookups: valid, malformed, unknown and revoked tokens', async () => {
  const quote = await newQuote();
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const pub = await links.getPublicQuote(token, TODAY);
  assert.equal(pub!.quoteNumber, quote.quoteNumber);
  assert.equal(pub!.state, 'open');

  assert.equal(await links.getPublicQuote('not-a-token', TODAY), null);
  assert.equal(await links.getPublicQuote(generateLinkToken(), TODAY), null);
  assert.equal(await links.getPublicQuote(quote.id, TODAY), null); // a quote id is not a token

  await links.revokeClientLink(quote.id, staff);
  assert.equal(await links.getPublicQuote(token, TODAY), null);
  assert.equal((await links.getStaffClientLink(quote.id)).link, null);
});

test('regenerating replaces the old link', async () => {
  const quote = await newQuote();
  const first = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const second = tokenOf((await links.createClientLink(quote.id, staff)).path);
  assert.notEqual(first, second);
  assert.equal(await links.getPublicQuote(first, TODAY), null);
  assert.ok(await links.getPublicQuote(second, TODAY));
  const events = await client.execute({ sql: 'SELECT event FROM quote_activity WHERE quote_id = ? ORDER BY id', args: [quote.id] });
  assert.deepEqual(events.rows.map((r) => r.event), ['client_link_created', 'client_link_revoked', 'client_link_created']);
});

test('a link with its own expiry stops working after it', async () => {
  const quote = await newQuote();
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  await client.execute({ sql: "UPDATE quote_access_links SET expires_at = '2000-01-01T00:00:00.000Z' WHERE quote_id = ?", args: [quote.id] });
  assert.equal(await links.getPublicQuote(token, TODAY), null);
});

test('the public view holds only client-facing fields', async () => {
  const quote = await newQuote();
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const pub = (await links.getPublicQuote(token, TODAY))!;
  const json = JSON.stringify(pub);
  for (const secret of [quote.id, staff.email, 'createdByEmail', 'updatedByEmail', 'eventId', 'invoices', '"id"', 'sortOrder', 'statusChangedAt']) {
    assert.ok(!json.includes(secret), `public quote leaks ${secret}`);
  }
  assert.deepEqual(Object.keys(pub).sort(), ['customer', 'event', 'notes', 'quoteDate', 'quoteNumber', 'response', 'sections', 'state', 'terms', 'totals', 'validUntil', 'version']);
  assert.equal(pub.totals.totalCents, 113000);
  assert.equal(pub.totals.taxLabel, 'HST 13%');
  assert.equal(pub.totals.depositLabel, 'Deposit required (50%)');
});

test('views are counted and a sent quote becomes viewed, without changing its version', async () => {
  const quote = await newQuote();
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const before = (await links.getPublicQuote(token, TODAY))!;
  assert.equal(await links.recordClientView(token), true);
  assert.equal(await links.recordClientView(token), true);
  assert.equal(await links.recordClientView(generateLinkToken()), false);
  const staffView = await links.getStaffClientLink(quote.id);
  assert.equal(staffView.link!.viewCount, 2);
  assert.ok(staffView.link!.lastViewedAt);
  const after = await repo.getQuote(quote.id);
  assert.equal(after!.status, 'viewed');
  assert.equal((await links.getPublicQuote(token, TODAY))!.version, before.version);
});

test('accepting: recorded, quote accepted and locked, second accept refused', async () => {
  const quote = await newQuote();
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  await links.recordClientView(token);
  const pub = (await links.getPublicQuote(token, TODAY))!;

  const result = await links.acceptQuoteByLink(token, accept(pub.version), meta, TODAY);
  assert.equal(result.state, 'accepted');
  assert.deepEqual({ name: result.response!.name, title: result.response!.title, action: result.response!.action }, { name: 'Daniel Smith', title: 'Director', action: 'accepted' });

  const saved = (await repo.getQuote(quote.id))!;
  assert.equal(saved.status, 'accepted');
  assert.ok(saved.acceptedAt);
  // The client's acceptance made a Confirmed booking, linked to the quote.
  assert.ok(saved.eventId);
  const [booking] = (await client.execute({ sql: 'SELECT status, client_name FROM bookings WHERE id = ?', args: [saved.eventId] })).rows;
  assert.equal(booking.status, 'Confirmed');
  assert.equal(booking.client_name, saved.customerName);
  // Locked for staff editing.
  const edit = quoteCreateSchema.parse({
    id: randomUUID(),
    customerName: 'Someone else',
    eventId: null,
    eventDate: null,
    quoteDate: '2026-10-01',
    validUntil: '2026-11-12',
    items: [{ section: 'A', itemName: 'B', quantity: 1, unitPriceCents: 1 }],
    discountType: 'none',
    discountValue: 0,
    taxLabel: 'HST',
    taxRateBp: 1300,
    depositType: 'none',
    depositValue: 0,
  });
  await assert.rejects(repo.updateQuote(quote.id, { ...edit, expectedUpdatedAt: saved.updatedAt }, staff), /Accepted quotes can.t be edited/);

  const record = (await client.execute({ sql: 'SELECT * FROM quote_acceptances WHERE quote_id = ?', args: [quote.id] })).rows[0];
  assert.equal(record.action, 'accepted');
  assert.equal(record.customer_name, 'Daniel Smith');
  assert.equal(record.signature_type, 'typed');
  assert.equal(record.signature_data, 'Daniel Smith');
  assert.equal(record.accepted_terms, 1);
  assert.equal(record.ip_address, meta.ipAddress);
  assert.equal(record.user_agent, meta.userAgent);
  assert.equal(record.quote_total_cents, 113000);
  assert.equal(record.quote_version, pub.version);

  // Duplicate acceptance (same version, or the new one) is refused.
  await assert.rejects(links.acceptQuoteByLink(token, accept(pub.version), meta, TODAY), /already been accepted/);
  await assert.rejects(links.acceptQuoteByLink(token, accept(result.version), meta, TODAY), /already been accepted/);
  await assert.rejects(links.declineQuoteByLink(token, quoteDeclineInputSchema.parse({ version: result.version }), meta, TODAY), /already been accepted/);
  assert.equal((await client.execute({ sql: 'SELECT COUNT(*) AS n FROM quote_acceptances WHERE quote_id = ?', args: [quote.id] })).rows[0].n, 1);

  const events = await client.execute({ sql: "SELECT event, actor_type FROM quote_activity WHERE quote_id = ? AND event = 'quote_accepted'", args: [quote.id] });
  assert.deepEqual(events.rows.map((r) => [r.event, r.actor_type]), [['quote_accepted', 'client']]);
  const audit = await client.execute({ sql: "SELECT changed_by_user_id FROM sales_audit_log WHERE entity_id = ? AND action = 'status' ORDER BY id DESC LIMIT 1", args: [quote.id] });
  assert.equal(audit.rows[0].changed_by_user_id, 'client');

  // Staff still see the link and the response.
  const staffView = await links.getStaffClientLink(quote.id);
  assert.equal(staffView.responses[0].customerName, 'Daniel Smith');
});

test('a drawn signature is stored as a PNG', async () => {
  const quote = await newQuote();
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const pub = (await links.getPublicQuote(token, TODAY))!;
  const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]).toString('base64');
  await links.acceptQuoteByLink(token, accept(pub.version, { type: 'drawn', value: png }), meta, TODAY);
  const r = (await links.getStaffClientLink(quote.id)).responses[0];
  assert.equal(r.signatureType, 'drawn');
  assert.equal(r.signatureData, png);
});

test('an expired quote cannot be accepted (current valid-until, not the link)', async () => {
  const quote = await newQuote('2026-10-10'); // before TODAY
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const pub = (await links.getPublicQuote(token, TODAY))!;
  assert.equal(pub.state, 'expired');
  await assert.rejects(links.acceptQuoteByLink(token, accept(pub.version), meta, TODAY), /expired/);
  // Still open the day it expires.
  assert.equal((await links.getPublicQuote(token, '2026-10-10'))!.state, 'open');
});

test('a quote changed after the client opened it must be reviewed again', async () => {
  const quote = await newQuote();
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const seen = (await links.getPublicQuote(token, TODAY))!;
  const current = (await repo.getQuote(quote.id))!;
  await repo.setQuoteStatus(quote.id, { status: 'draft', expectedUpdatedAt: current.updatedAt }, staff);
  const reopened = (await repo.getQuote(quote.id))!;
  await repo.setQuoteStatus(quote.id, { status: 'sent', expectedUpdatedAt: reopened.updatedAt }, staff);
  await assert.rejects(links.acceptQuoteByLink(token, accept(seen.version), meta, TODAY), /updated since you opened it/);
});

test('declining: optional reason, quote declined, can no longer be accepted', async () => {
  const quote = await newQuote();
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const pub = (await links.getPublicQuote(token, TODAY))!;
  const result = await links.declineQuoteByLink(token, quoteDeclineInputSchema.parse({ version: pub.version, reason: ' Budget changed ' }), meta, TODAY);
  assert.equal(result.state, 'declined');
  assert.equal((await repo.getQuote(quote.id))!.status, 'declined');
  const r = (await links.getStaffClientLink(quote.id)).responses[0];
  assert.deepEqual([r.action, r.declineReason, r.customerName, r.signatureType], ['declined', 'Budget changed', null, null]);
  await assert.rejects(links.acceptQuoteByLink(token, accept(result.version), meta, TODAY), /already been declined/);
});

test('draft and cancelled quotes are not open to clients', async () => {
  const quote = await newQuote();
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const sent = (await repo.getQuote(quote.id))!;
  await repo.setQuoteStatus(quote.id, { status: 'draft', expectedUpdatedAt: sent.updatedAt }, staff);
  const pub = (await links.getPublicQuote(token, TODAY))!;
  assert.equal(pub.state, 'unavailable');
  await assert.rejects(links.acceptQuoteByLink(token, accept(pub.version), meta, TODAY), /isn’t open for a response/);
});

test('the database refuses an incomplete acceptance', async () => {
  const quote = await newQuote();
  await assert.rejects(
    client.execute({
      sql: "INSERT INTO quote_acceptances (id, quote_id, action, customer_name, accepted_terms, quote_total_cents, quote_version, created_at) VALUES (?, ?, 'accepted', 'X', 0, 1, 'v', 'now')",
      args: [randomUUID(), quote.id],
    }),
  );
});

// ---------------------------------------------------------------------------
// Client acceptance → booking
// ---------------------------------------------------------------------------

const bookingsNamed = async (title: string) =>
  Number((await client.execute({ sql: 'SELECT count(*) AS n FROM bookings WHERE event_title = ?', args: [title] })).rows[0].n);

// A sent quote with a live link, its event given a unique name to count by.
async function openQuote(eventName: string, eventId: number | null = null) {
  const quote = await newQuote();
  if (eventId !== null || eventName) await client.execute({ sql: 'UPDATE quotes SET event_name = ?, event_id = ? WHERE id = ?', args: [eventName, eventId, quote.id] });
  const token = tokenOf((await links.createClientLink(quote.id, staff)).path);
  const pub = (await links.getPublicQuote(token, TODAY))!;
  return { quote, token, version: pub.version };
}

test('a client acceptance creates exactly one Confirmed booking, even when clicked twice', async () => {
  const { quote, token, version } = await openQuote('Twice Gala');
  await links.acceptQuoteByLink(token, accept(version), meta, TODAY);
  await assert.rejects(links.acceptQuoteByLink(token, accept(version), meta, TODAY), /already been accepted/);
  assert.equal(await bookingsNamed('Twice Gala'), 1);
  const saved = (await repo.getQuote(quote.id))!;
  const [b] = (await client.execute({ sql: 'SELECT status, notes FROM bookings WHERE id = ?', args: [saved.eventId] })).rows;
  assert.equal(b.status, 'Confirmed');
  assert.match(String(b.notes), new RegExp(`accepted quote ${saved.quoteNumber}`));
});

test('a quote already linked to a Tentative booking confirms it instead of making another', async () => {
  const inserted = await client.execute(
    "INSERT INTO bookings (event_title, client_name, client_phone, client_email, event_date, setup_time, start_time, end_time, venue_name, venue_address, event_type) VALUES ('Linked Gala', 'Sam', '', '', '2026-12-01', '', '', '', '', '', 'Corporate') RETURNING id",
  );
  const bookingId = Number(inserted.rows[0].id);
  const { quote, token, version } = await openQuote('Linked Gala', bookingId);
  await links.acceptQuoteByLink(token, accept(version), meta, TODAY);
  assert.equal(await bookingsNamed('Linked Gala'), 1);
  assert.equal((await repo.getQuote(quote.id))!.eventId, bookingId);
  const [b] = (await client.execute({ sql: 'SELECT status FROM bookings WHERE id = ?', args: [bookingId] })).rows;
  assert.equal(b.status, 'Confirmed');
});

test('a failed booking never undoes the acceptance; the recovery action then books it, once', async () => {
  const { quote, token, version } = await openQuote('Recovery Gala');
  // Make the booking step fail: its equipment table is briefly missing.
  await client.execute('ALTER TABLE booking_equipment RENAME TO booking_equipment_away');
  const realError = console.error;
  console.error = () => {}; // the expected "[quotes] … failed" log
  try {
    const result = await links.acceptQuoteByLink(token, accept(version), meta, TODAY);
    assert.equal(result.state, 'accepted');
  } finally {
    console.error = realError;
    await client.execute('ALTER TABLE booking_equipment_away RENAME TO booking_equipment');
  }
  const afterFailure = (await repo.getQuote(quote.id))!;
  assert.equal(afterFailure.status, 'accepted'); // acceptance kept
  assert.equal(afterFailure.eventId, null); // nothing half-made
  assert.equal(await bookingsNamed('Recovery Gala'), 0);
  const acceptances = await client.execute({ sql: "SELECT count(*) AS n FROM quote_acceptances WHERE quote_id = ? AND action = 'accepted'", args: [quote.id] });
  assert.equal(Number(acceptances.rows[0].n), 1);

  // "Create booking" on Quote Details: same logic, safe to repeat.
  const first = await booking.bookAcceptedQuote(quote.id, { userId: staff.id, email: staff.email });
  const again = await booking.bookAcceptedQuote(quote.id, { userId: staff.id, email: staff.email });
  assert.deepEqual(first, { bookingId: first!.bookingId, created: true });
  assert.deepEqual(again, { bookingId: first!.bookingId, created: false });
  assert.equal(await bookingsNamed('Recovery Gala'), 1);
  assert.equal((await repo.getQuote(quote.id))!.eventId, first!.bookingId);
});

test('no client acceptance, no booking: a quote marked Accepted by hand is refused by recovery too', async () => {
  const quote = await newQuote();
  await client.execute({ sql: "UPDATE quotes SET event_name = 'Manual Gala' WHERE id = ?", args: [quote.id] });
  const fresh = (await repo.getQuote(quote.id))!;
  const accepted = await repo.setQuoteStatus(quote.id, { status: 'accepted', expectedUpdatedAt: fresh.updatedAt }, staff);
  assert.equal(accepted.eventId, null);
  assert.equal(await booking.bookAcceptedQuote(quote.id, { userId: staff.id, email: staff.email }), null);
  assert.equal(await bookingsNamed('Manual Gala'), 0);
});

// Last: a local SQLite file fails competing writers fast (SQLITE_BUSY)
// instead of queueing them like Turso, and can stay locked a moment after.
// Whatever the database does, two acceptances racing can never both win or
// make two bookings.
test('two acceptances at the same moment never both win or make two bookings', async () => {
  const { quote, token, version } = await openQuote('Race Gala');
  const realError = console.error;
  console.error = () => {};
  let won = 0;
  try {
    const results = await Promise.allSettled([
      links.acceptQuoteByLink(token, accept(version), meta, TODAY),
      links.acceptQuoteByLink(token, accept(version), meta, TODAY),
    ]);
    won = results.filter((r) => r.status === 'fulfilled').length;
  } finally {
    console.error = realError;
  }
  assert.ok(won <= 1, 'at most one acceptance');
  assert.ok((await bookingsNamed('Race Gala')) <= 1, 'never two bookings');
  const acceptances = await client.execute({ sql: "SELECT count(*) AS n FROM quote_acceptances WHERE quote_id = ? AND action = 'accepted'", args: [quote.id] });
  assert.equal(Number(acceptances.rows[0].n), won);
});
