// Runs the real quote → invoice conversion against a throwaway local SQLite
// file with every migration applied — never the shared Turso database.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { splitMigration } from './migrationGuard';
import { quoteCreateSchema, type QuoteCreateInput } from '../schemas/quote';
import type { QuoteDto } from './quoteRepo';

const dir = mkdtempSync(join(tmpdir(), 'harmony-invoices-'));
const url = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;

let client: Client;
let quoteRepo: typeof import('./quoteRepo');
let invoiceRepo: typeof import('./invoiceRepo');
const actor = { id: 'user-1', email: 'partner@example.com' };
const TODAY = '2026-10-29';

before(async () => {
  client = createClient({ url });
  // `bookings` belongs to Event-booking-app, so no migration creates it.
  await client.execute(`CREATE TABLE bookings (
    id integer PRIMARY KEY AUTOINCREMENT, event_title text NOT NULL, client_name text NOT NULL, client_phone text NOT NULL,
    client_email text NOT NULL, event_date text NOT NULL, setup_time text NOT NULL, start_time text NOT NULL, end_time text NOT NULL,
    venue_name text NOT NULL, venue_address text NOT NULL, event_type text NOT NULL, notes text, status text NOT NULL DEFAULT 'Tentative',
    created_by integer, created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT '', pickup_date text, pickup_time text)`);
  const migrations = readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) await client.batch(splitMigration(readFileSync(join('drizzle', file), 'utf8')), 'write');
  quoteRepo = await import('./quoteRepo');
  invoiceRepo = await import('./invoiceRepo');
});

after(() => {
  client?.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the file briefly; it's in the temp folder.
  }
});

function input(overrides: Partial<Record<keyof QuoteCreateInput, unknown>> = {}): QuoteCreateInput {
  return quoteCreateSchema.parse({
    id: randomUUID(),
    customerName: 'Michael Smith',
    customerEmail: 'michael@example.com',
    eventId: null,
    eventName: 'Smith Gala',
    eventDate: '2026-11-20',
    quoteDate: '2026-10-13',
    validUntil: '2026-11-12',
    items: [
      { section: 'LED Display', itemName: 'Outdoor LED Wall P3.9', quantity: 1, unitPriceCents: 240000, discountType: 'fixed', discountValue: 10000 },
      { section: 'Sound', itemName: 'Wireless Microphones', quantity: 6, unitPriceCents: 6000 },
    ],
    discountType: 'percent',
    discountValue: 500,
    taxLabel: 'HST',
    taxRateBp: 1300,
    depositType: 'percent',
    depositValue: 3000,
    notes: 'Load-in from the back door.',
    terms: 'Payment: balance on the event day.',
    ...overrides,
  });
}

async function acceptedQuote(overrides: Partial<Record<keyof QuoteCreateInput, unknown>> = {}): Promise<QuoteDto> {
  const { quote } = await quoteRepo.createQuote(input(overrides), actor);
  return quoteRepo.setQuoteStatus(quote.id, { status: 'accepted', expectedUpdatedAt: quote.updatedAt }, actor);
}

const convert = (q: QuoteDto, extra: { invoiceId?: string; dueDate?: string; depositPaidCents?: number; expectedUpdatedAt?: string; clientPoNumber?: string | null } = {}) =>
  invoiceRepo.convertQuoteToInvoice(q.id, { invoiceId: randomUUID(), expectedUpdatedAt: q.updatedAt, dueDate: '2026-11-20', depositPaidCents: 0, depositMethod: 'etransfer' as const, depositReceivedOn: null, ...extra }, TODAY, actor);

test('converts an accepted quote: items and figures copied exactly, quote marked Converted', async () => {
  const quote = await acceptedQuote();
  const converted = await convert(quote);
  assert.equal(converted.status, 'converted');
  assert.equal(converted.invoices.length, 1);
  assert.equal(converted.invoices[0].invoiceNumber, 'INV-000000001');
  assert.equal(converted.invoices[0].status, 'draft');

  const invoice = (await invoiceRepo.getInvoice(converted.invoices[0].id))!;
  assert.equal(invoice.quoteId, quote.id);
  assert.equal(invoice.quoteNumber, quote.quoteNumber);
  assert.equal(invoice.invoiceDate, TODAY);
  assert.equal(invoice.dueDate, '2026-11-20');
  assert.equal(invoice.customerName, 'Michael Smith');
  assert.equal(invoice.eventName, 'Smith Gala');
  assert.equal(invoice.notes, quote.notes);
  assert.equal(invoice.terms, quote.terms);
  for (const k of ['subtotalCents', 'discountType', 'discountValue', 'discountCents', 'taxLabel', 'taxRateBp', 'taxCents', 'totalCents'] as const) {
    assert.equal(invoice[k], quote[k], k);
  }
  assert.equal(invoice.balanceDueCents, quote.totalCents);
  const withoutId = (items: QuoteDto['items']) => items.map((i) => ({ ...i, id: undefined }));
  assert.deepEqual(withoutId(invoice.items), withoutId(quote.items));

  // Locked now, and the history records both sides.
  await assert.rejects(quoteRepo.updateQuote(quote.id, { ...input(), expectedUpdatedAt: converted.updatedAt }, actor), /Converted quotes can't be edited/);
  const log = await client.execute({ sql: "SELECT entity_type, action FROM sales_audit_log WHERE entity_id IN (?, ?) AND action IN ('convert', 'create') ORDER BY id", args: [quote.id, invoice.id] });
  assert.deepEqual(
    log.rows.filter((r) => !(r.entity_type === 'quote' && r.action === 'create')).map((r) => `${r.entity_type}:${r.action}`),
    ['invoice:create', 'quote:convert'],
  );
});

test('a deposit already received is its first payment: off the balance, Partially Paid; the whole total paid marks it Paid', async () => {
  const quote = await acceptedQuote();
  const withDeposit = await convert(quote, { depositPaidCents: quote.depositRequiredCents });
  const invoice = (await invoiceRepo.getInvoice(withDeposit.invoices[0].id))!;
  assert.equal(invoice.depositPaidCents, quote.depositRequiredCents);
  assert.equal(invoice.balanceDueCents, quote.totalCents - quote.depositRequiredCents);
  assert.equal(invoice.status, 'partially_paid');
  // Recorded as the invoice's first payment, dated today unless given.
  assert.equal(invoice.payments.length, 1);
  assert.deepEqual([invoice.payments[0].kind, invoice.payments[0].amountCents, invoice.payments[0].method, invoice.payments[0].receivedOn], ['deposit', quote.depositRequiredCents, 'etransfer', TODAY]);

  const other = await acceptedQuote();
  const paidUp = await convert(other, { depositPaidCents: other.totalCents });
  const paid = (await invoiceRepo.getInvoice(paidUp.invoices[0].id))!;
  assert.equal(paid.balanceDueCents, 0);
  assert.equal(paid.status, 'paid');
  assert.ok(paid.paidAt);

  const third = await acceptedQuote();
  await assert.rejects(convert(third, { depositPaidCents: third.totalCents + 1 }), /more than the invoice total/);
});

test('works for a quote marked Accepted by hand, and makes no booking', async () => {
  const before = Number((await client.execute('SELECT count(*) AS n FROM bookings')).rows[0].n);
  const converted = await convert(await acceptedQuote());
  assert.equal(converted.status, 'converted');
  assert.equal(converted.eventId, null);
  assert.equal(Number((await client.execute('SELECT count(*) AS n FROM bookings')).rows[0].n), before);
});

test('refused unless accepted, only once, not with a stale version or a past due date', async () => {
  const { quote: draft } = await quoteRepo.createQuote(input(), actor);
  await assert.rejects(convert(draft), /Only an accepted quote/);

  const quote = await acceptedQuote();
  await assert.rejects(convert(quote, { expectedUpdatedAt: '2000-01-01T00:00:00.000Z' }), /Someone else changed this quote/);
  await assert.rejects(convert(quote, { dueDate: '2026-10-28' }), /before today/);

  const converted = await convert(quote);
  await assert.rejects(convert(converted), /already been converted/);
  const count = await client.execute({ sql: 'SELECT count(*) AS n FROM invoices WHERE quote_id = ?', args: [quote.id] });
  assert.equal(Number(count.rows[0].n), 1);
});

test('a retried request with the same invoice id returns the quote instead of a second invoice', async () => {
  const quote = await acceptedQuote();
  const invoiceId = randomUUID();
  const first = await convert(quote, { invoiceId });
  const retry = await convert(quote, { invoiceId }); // the old version, as the browser resends it
  assert.equal(retry.status, 'converted');
  assert.deepEqual(retry.invoices, first.invoices);
});

test('numbers invoices in order', async () => {
  const a = await convert(await acceptedQuote());
  const b = await convert(await acceptedQuote());
  const n = (q: QuoteDto) => Number(q.invoices[0].invoiceNumber.slice(4));
  assert.equal(n(b), n(a) + 1);
});

test('client PO: copied from the quote, can be changed when converting, and added, edited or cleared on the invoice', async () => {
  const withPo = await acceptedQuote({ clientPoNumber: '  PO-100 ' });
  assert.equal(withPo.clientPoNumber, 'PO-100');
  const copied = await convert(withPo);
  const first = (await invoiceRepo.getInvoice(copied.invoices[0].id))!;
  assert.equal(first.clientPoNumber, 'PO-100');

  const changed = await convert(await acceptedQuote({ clientPoNumber: 'PO-OLD' }), { clientPoNumber: 'PO-NEW' });
  assert.equal((await invoiceRepo.getInvoice(changed.invoices[0].id))!.clientPoNumber, 'PO-NEW');

  const added = await invoiceRepo.updateInvoicePo(first.id, { clientPoNumber: 'PO-101', expectedUpdatedAt: first.updatedAt }, actor);
  assert.equal(added.clientPoNumber, 'PO-101');
  await assert.rejects(invoiceRepo.updateInvoicePo(first.id, { clientPoNumber: 'PO-102', expectedUpdatedAt: first.updatedAt }, actor), /Someone else changed this invoice/);
  const cleared = await invoiceRepo.updateInvoicePo(first.id, { clientPoNumber: null, expectedUpdatedAt: added.updatedAt }, actor);
  assert.equal(cleared.clientPoNumber, null);

  // A copy of the quote is a new order, so it starts without the PO.
  const clone = await quoteRepo.cloneQuote(withPo.id, randomUUID(), TODAY, actor);
  assert.equal(clone.clientPoNumber, null);
});
