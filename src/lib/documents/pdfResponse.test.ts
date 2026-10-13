// The PDF routes' responses, against a throwaway local SQLite file with every
// migration applied (never the shared Turso database). Skipped when no
// Chrome/Chromium is installed.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { splitMigration } from '../db/migrationGuard';
import { quoteCreateSchema } from '../schemas/quote';
import { closePdfBrowser, localChromePath } from './renderPdf';
import { SAMPLE_CONFIG } from './testFixtures';

const skip = localChromePath() ? false : 'no Chrome/Chromium installed';
const dir = mkdtempSync(join(tmpdir(), 'harmony-pdf-'));
const url = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;

let client: Client;
let pdf: typeof import('./pdfResponse');
let quoteId = '';
let invoiceId = '';

before(async () => {
  client = createClient({ url });
  await client.execute(
    "CREATE TABLE bookings (id integer PRIMARY KEY AUTOINCREMENT, event_title text NOT NULL, client_name text NOT NULL, client_phone text NOT NULL, client_email text NOT NULL, event_date text NOT NULL, setup_time text NOT NULL, start_time text NOT NULL, end_time text NOT NULL, venue_name text NOT NULL, venue_address text NOT NULL, event_type text NOT NULL, notes text, status text NOT NULL DEFAULT 'Tentative', created_by integer, created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT '', pickup_date text, pickup_time text)",
  );
  for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) await client.batch(splitMigration(readFileSync(join('drizzle', f), 'utf8')), 'write');

  const repo = await import('../db/quoteRepo');
  pdf = await import('./pdfResponse');
  const { quote } = await repo.createQuote(
    quoteCreateSchema.parse({
      id: randomUUID(),
      customerName: 'Michael Smith',
      eventId: null,
      eventDate: null,
      quoteDate: '2026-10-13',
      validUntil: '2026-11-12',
      items: [
        { section: 'LED Display', itemName: 'Outdoor LED Wall P3.9', quantity: 1, unitPriceCents: 240000 },
        { section: 'Sound', itemName: 'Wireless Microphones', quantity: 6, unitPriceCents: 6000, discountType: 'percent', discountValue: 1000 },
      ],
      discountType: 'percent',
      discountValue: 500,
      taxLabel: 'HST',
      taxRateBp: 1300,
      depositType: 'percent',
      depositValue: 5000,
      terms: 'Term one.\nTerm two.',
    }),
    { id: 'user-1', email: 'partner@example.com' },
  );
  quoteId = quote.id;

  // No invoice-creation flow exists yet (Phase 4), so write one directly,
  // copied from the quote the way conversion will.
  invoiceId = randomUUID();
  const deposit = quote.depositRequiredCents;
  await client.execute({
    sql: `INSERT INTO invoices (id, invoice_number, quote_id, status, customer_name, invoice_date, due_date, subtotal_cents, discount_type, discount_value, discount_cents, tax_rate_bp, tax_cents, total_cents, deposit_paid_cents, balance_due_cents, terms, created_by_user_id, created_by_email, updated_by_email, created_at, updated_at)
          VALUES (?, 'INV-000000001', ?, 'sent', 'Michael Smith', '2026-10-13', '2026-10-27', ?, 'percent', 500, ?, 1300, ?, ?, ?, ?, 'Pay by the due date.', 'u', 'e', 'e', 'now', 'now')`,
    args: [invoiceId, quote.id, quote.subtotalCents, quote.discountCents, quote.taxCents, quote.totalCents, deposit, quote.totalCents - deposit],
  });
  for (const i of quote.items) {
    await client.execute({
      sql: `INSERT INTO invoice_items (id, invoice_id, section, item_name, quantity, unit_price_cents, line_total_cents, discount_type, discount_value, discount_cents, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'now', 'now')`,
      args: [randomUUID(), invoiceId, i.section, i.itemName, i.quantity, i.unitPriceCents, i.lineTotalCents, i.discountType, i.discountValue, i.discountCents, i.sortOrder],
    });
  }
});

after(async () => {
  await closePdfBrowser();
  client?.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the file briefly; it's in the temp folder.
  }
});

async function expectPdf(res: Response, disposition: 'inline' | 'attachment', fileName: string) {
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.equal(res.headers.get('content-disposition'), `${disposition}; filename="${fileName}"`);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.equal(Number(res.headers.get('content-length')), bytes.byteLength);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
}

test('quote PDF: inline for preview, attachment for download', { skip }, async () => {
  await expectPdf(await pdf.quotePdfResponse(quoteId, false, SAMPLE_CONFIG), 'inline', 'Harmony_Production_Quote_Q-000000001.pdf');
  await expectPdf(await pdf.quotePdfResponse(quoteId, true, SAMPLE_CONFIG), 'attachment', 'Harmony_Production_Quote_Q-000000001.pdf');
});

test('invoice PDF from the invoice’s own copy of the items', { skip }, async () => {
  await expectPdf(await pdf.invoicePdfResponse(invoiceId, true, SAMPLE_CONFIG), 'attachment', 'Harmony_Production_Invoice_INV-000000001.pdf');
});

test('a missing document is a clean 404, not a PDF', { skip }, async () => {
  for (const res of [await pdf.quotePdfResponse(randomUUID(), false), await pdf.invoicePdfResponse(randomUUID(), false)]) {
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
    assert.match((await res.json()).error, /not found/);
  }
});
