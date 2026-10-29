// Recording and undoing invoice payments, against a throwaway local SQLite
// file with every migration applied — never the shared Turso database.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { splitMigration } from './migrationGuard';
import { quoteCreateSchema } from '../schemas/quote';
import { invoicePaymentSchema } from '../schemas/invoice';
import { SAMPLE_CONFIG } from '../documents/testFixtures';
import type { InvoiceDto } from './invoiceRepo';

const dir = mkdtempSync(join(tmpdir(), 'harmony-payments-'));
const url = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;

let client: Client;
let quoteRepo: typeof import('./quoteRepo');
let invoiceRepo: typeof import('./invoiceRepo');
let repo: typeof import('./invoicePaymentRepo');
let receipts: typeof import('../sales/sendReceipt');
let receiptEmail: typeof import('../sales/receiptEmail');
const actor = { id: 'user-1', email: 'partner@example.com' };
const TODAY = '2026-10-29';

before(async () => {
  client = createClient({ url });
  await client.execute(`CREATE TABLE bookings (
    id integer PRIMARY KEY AUTOINCREMENT, event_title text NOT NULL, client_name text NOT NULL, client_phone text NOT NULL,
    client_email text NOT NULL, event_date text NOT NULL, setup_time text NOT NULL, start_time text NOT NULL, end_time text NOT NULL,
    venue_name text NOT NULL, venue_address text NOT NULL, event_type text NOT NULL, notes text, status text NOT NULL DEFAULT 'Tentative',
    created_by integer, created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT '', pickup_date text, pickup_time text)`);
  for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) await client.batch(splitMigration(readFileSync(join('drizzle', f), 'utf8')), 'write');
  quoteRepo = await import('./quoteRepo');
  invoiceRepo = await import('./invoiceRepo');
  repo = await import('./invoicePaymentRepo');
  receipts = await import('../sales/sendReceipt');
  receiptEmail = await import('../sales/receiptEmail');
});

after(() => {
  client?.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the file briefly; it's in the temp folder.
  }
});

// An invoice of $1,000.00 (no tax, no discount), optionally with a deposit.
async function invoice(depositPaidCents = 0): Promise<InvoiceDto> {
  const { quote } = await quoteRepo.createQuote(
    quoteCreateSchema.parse({
      id: randomUUID(),
      customerName: 'Michael Smith',
      customerEmail: 'michael@example.com',
      eventId: null,
      eventName: 'Smith Gala',
      eventDate: '2026-11-20',
      quoteDate: '2026-10-13',
      validUntil: '2026-11-12',
      items: [{ section: 'Sound', itemName: 'PA system', quantity: 1, unitPriceCents: 100000 }],
      discountType: 'none',
      discountValue: 0,
      taxLabel: 'HST',
      taxRateBp: 0,
      depositType: 'percent',
      depositValue: 3000,
    }),
    actor,
  );
  const accepted = await quoteRepo.setQuoteStatus(quote.id, { status: 'accepted', expectedUpdatedAt: quote.updatedAt }, actor);
  const converted = await invoiceRepo.convertQuoteToInvoice(
    quote.id,
    { invoiceId: randomUUID(), expectedUpdatedAt: accepted.updatedAt, dueDate: '2026-11-20', depositPaidCents, depositMethod: depositPaidCents ? 'etransfer' : null, depositReceivedOn: '2026-10-20' },
    TODAY,
    actor,
  );
  return (await invoiceRepo.getInvoice(converted.invoices[0].id))!;
}

const pay = (inv: InvoiceDto, values: Record<string, unknown> = {}) =>
  repo.recordInvoicePayment(inv.id, invoicePaymentSchema.parse({ paymentId: randomUUID(), expectedUpdatedAt: inv.updatedAt, amountCents: 20000, method: 'etransfer', receivedOn: TODAY, ...values }), TODAY, actor);

test('a payment comes off the balance and makes the invoice Partially Paid, then Paid', async () => {
  const inv = await invoice(30000);
  assert.equal(inv.balanceDueCents, 70000);

  const once = await pay(inv, { amountCents: 20000, method: 'cash', reference: 'Paid at the venue' });
  assert.equal(once.status, 'partially_paid');
  assert.equal(once.depositPaidCents, 30000);
  assert.equal(once.amountPaidCents, 20000);
  assert.equal(once.balanceDueCents, 50000);
  assert.equal(once.payments.length, 2);
  assert.deepEqual([once.payments[0].kind, once.payments[0].method, once.payments[0].reference], ['payment', 'cash', 'Paid at the venue']);

  const rest = await pay(once, { amountCents: 50000 });
  assert.equal(rest.status, 'paid');
  assert.equal(rest.balanceDueCents, 0);
  assert.ok(rest.paidAt);
  await assert.rejects(pay(rest, { amountCents: 1 }), /paid in full/);
});

test('refused: more than the balance, a future date, a stale version', async () => {
  const inv = await invoice();
  await assert.rejects(pay(inv, { amountCents: 100001 }), /more than the balance due \(\$1,000\.00\)/);
  await assert.rejects(pay(inv, { receivedOn: '2026-10-30' }), /in the future/);
  await assert.rejects(pay(inv, { expectedUpdatedAt: '2000-01-01T00:00:00.000Z' }), /Someone else changed this invoice/);
  assert.throws(() => invoicePaymentSchema.parse({ paymentId: randomUUID(), expectedUpdatedAt: 'x', amountCents: 100, method: 'cheque', receivedOn: TODAY }), /how it was paid/);
});

test('a retried request with the same payment id records it once', async () => {
  const inv = await invoice();
  const paymentId = randomUUID();
  const first = await pay(inv, { paymentId });
  const retry = await pay(inv, { paymentId });
  assert.equal(retry.payments.length, 1);
  assert.equal(retry.balanceDueCents, first.balanceDueCents);
});

test('undoing a payment keeps it in the history and restores the balance and status', async () => {
  const inv = await invoice();
  const paid = await pay(inv, { amountCents: 100000 });
  assert.equal(paid.status, 'paid');

  const undone = await repo.voidInvoicePayment(inv.id, paid.payments[0].id, { expectedUpdatedAt: paid.updatedAt, reason: 'Entered twice' }, actor);
  assert.equal(undone.status, 'draft');
  assert.equal(undone.balanceDueCents, 100000);
  assert.equal(undone.paidAt, null);
  assert.equal(undone.payments.length, 1);
  assert.ok(undone.payments[0].voidedAt);
  assert.equal(undone.payments[0].voidReason, 'Entered twice');
  await assert.rejects(repo.voidInvoicePayment(inv.id, paid.payments[0].id, { expectedUpdatedAt: undone.updatedAt, reason: null }, actor), /already undone/);

  const log = await client.execute({ sql: "SELECT count(*) AS n FROM sales_audit_log WHERE entity_id = ? AND action = 'payment'", args: [inv.id] });
  assert.equal(Number(log.rows[0].n), 2);
});

test('Finances lists live payments only, with their invoice', async () => {
  const inv = await invoice(30000);
  const paid = await pay(inv, { amountCents: 10000 });
  await repo.voidInvoicePayment(inv.id, paid.payments[0].id, { expectedUpdatedAt: paid.updatedAt, reason: null }, actor);
  const mine = (await repo.listReceivedPayments()).filter((p) => p.invoiceId === inv.id);
  assert.equal(mine.length, 1);
  assert.deepEqual([mine[0].kind, mine[0].amountCents, mine[0].receivedOn, mine[0].invoiceNumber], ['deposit', 30000, '2026-10-20', inv.invoiceNumber]);
});

test('receipt: says what was paid and what is left; never sent without email set up', async () => {
  const inv = await pay(await invoice(30000), { amountCents: 20000, reference: 'ET-123' });
  const content = receiptEmail.receiptEmailContent(inv, inv.payments[0], SAMPLE_CONFIG);
  assert.match(content.subject, /^Payment received — INV-/);
  assert.match(content.text, /received your payment of \$200\.00/);
  assert.match(content.text, /remaining balance of \$500\.00 is due by/);
  assert.match(content.text, /Reference: ET-123/);

  const full = await pay(inv, { amountCents: 50000 });
  assert.match(receiptEmail.receiptEmailContent(full, full.payments[0], SAMPLE_CONFIG).text, /paid in full/);

  delete process.env.RESEND_API_KEY;
  await assert.rejects(receipts.sendPaymentReceipt(inv.id, inv.payments[0].id, randomUUID(), SAMPLE_CONFIG), /Email isn’t set up/);
});

test('backfill: a deposit saved before payments existed gets its payment row, once', async () => {
  const { backfillDepositPayments } = await import('./backfillDepositPayments');
  const inv = await invoice(30000);
  // As an invoice converted before 0014: the deposit is on the invoice only.
  await client.execute({ sql: 'DELETE FROM invoice_payments WHERE invoice_id = ?', args: [inv.id] });

  const dry = await backfillDepositPayments(client, true);
  assert.deepEqual(dry.filter((d) => d.invoiceId === inv.id).map((d) => d.missingCents), [30000]);
  assert.equal((await invoiceRepo.getInvoice(inv.id))!.payments.length, 0);

  await backfillDepositPayments(client, false);
  const after = (await invoiceRepo.getInvoice(inv.id))!;
  assert.deepEqual([after.payments.length, after.payments[0].kind, after.payments[0].amountCents, after.payments[0].method, after.payments[0].receivedOn], [1, 'deposit', 30000, null, inv.invoiceDate]);
  assert.equal((await backfillDepositPayments(client, false)).filter((d) => d.invoiceId === inv.id).length, 0);
});
