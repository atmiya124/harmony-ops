// Sending a quote by email, against a throwaway local SQLite file (never
// Turso) and a stubbed Resend API (nothing is really sent). The PDF step
// needs Chrome/Chromium, so the sending tests skip without it.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { splitMigration } from '../db/migrationGuard';
import { quoteCreateSchema } from '../schemas/quote';
import { closePdfBrowser, localChromePath } from '../documents/renderPdf';
import { SAMPLE_CONFIG } from '../documents/testFixtures';
import { todayInFinanceTz } from '../finance/today';

const dir = mkdtempSync(join(tmpdir(), 'harmony-send-'));
const url = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;
process.env.BETTER_AUTH_SECRET ??= 'test-secret-for-client-links';

const noChrome = localChromePath() ? false : 'no Chrome/Chromium installed';
const staff = { id: 'user-1', email: 'partner@example.com' };
const origin = 'https://ops.test';
const realFetch = globalThis.fetch;
let client: Client;
let repo: typeof import('../db/quoteRepo');
let send: typeof import('./sendQuote');
let resend: typeof import('../email/resend');

before(async () => {
  client = createClient({ url });
  await client.execute(
    "CREATE TABLE bookings (id integer PRIMARY KEY AUTOINCREMENT, event_title text NOT NULL, client_name text NOT NULL, client_phone text NOT NULL, client_email text NOT NULL, event_date text NOT NULL, setup_time text NOT NULL, start_time text NOT NULL, end_time text NOT NULL, venue_name text NOT NULL, venue_address text NOT NULL, event_type text NOT NULL, notes text, status text NOT NULL DEFAULT 'Tentative', created_by integer, created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT '', pickup_date text, pickup_time text)",
  );
  for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) await client.batch(splitMigration(readFileSync(join('drizzle', f), 'utf8')), 'write');
  repo = await import('../db/quoteRepo');
  send = await import('./sendQuote');
  resend = await import('../email/resend');
});

after(async () => {
  globalThis.fetch = realFetch;
  await closePdfBrowser();
  client?.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows may still hold the file briefly; it's in the temp folder.
  }
});

async function newQuote(email: string | null = 'michael@example.com') {
  const { quote } = await repo.createQuote(
    quoteCreateSchema.parse({
      id: randomUUID(),
      customerName: 'Michael Smith',
      customerEmail: email,
      eventId: null,
      eventDate: null,
      quoteDate: todayInFinanceTz(),
      validUntil: '2099-12-31',
      items: [{ section: 'Sound', itemName: 'Wireless Microphones', quantity: 6, unitPriceCents: 6000 }],
      discountType: 'none',
      discountValue: 0,
      taxLabel: 'HST',
      taxRateBp: 1300,
      depositType: 'percent',
      depositValue: 3000,
    }),
    staff,
  );
  return quote;
}

function configure(on: boolean) {
  if (on) {
    process.env.RESEND_API_KEY = 're_test';
    process.env.QUOTE_EMAIL_FROM = 'Harmony Production <quotes@harmonyproduction.ca>';
  } else {
    delete process.env.RESEND_API_KEY;
    delete process.env.QUOTE_EMAIL_FROM;
  }
}

test('refused before anything happens: no client email, email not set up, or a stale version', async () => {
  configure(true);
  const noEmail = await newQuote(null);
  await assert.rejects(send.sendQuoteEmail(noEmail.id, { expectedUpdatedAt: noEmail.updatedAt, sendId: randomUUID() }, staff, origin, SAMPLE_CONFIG), /Add the client’s email/);

  configure(false);
  const q = await newQuote();
  await assert.rejects(send.sendQuoteEmail(q.id, { expectedUpdatedAt: q.updatedAt, sendId: randomUUID() }, staff, origin, SAMPLE_CONFIG), (e) => e instanceof resend.EmailError && e.status === 503);
  await assert.rejects(send.sendQuoteEmail(q.id, { expectedUpdatedAt: 'old', sendId: randomUUID() }, staff, origin, SAMPLE_CONFIG), (e: { status?: number }) => e.status === 409);
  // Nothing changed: still a draft with no client link and no sends.
  assert.equal((await repo.getQuote(q.id))!.status, 'draft');
  assert.deepEqual((await repo.getQuote(q.id))!.emailSends, []);
  const links = await client.execute({ sql: 'SELECT count(*) AS n FROM quote_access_links WHERE quote_id = ?', args: [q.id] });
  assert.equal(Number(links.rows[0].n), 0);
});

test('sends the link and the PDF to the client and marks the draft Sent', { skip: noChrome }, async () => {
  configure(true);
  const q = await newQuote();
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const sendId = randomUUID();
    const sent = await send.sendQuoteEmail(q.id, { expectedUpdatedAt: q.updatedAt, sendId }, staff, origin, SAMPLE_CONFIG);
    assert.equal(sent.status, 'sent');
    assert.equal(calls.length, 1);
    const [call] = calls;
    assert.equal(call.url, 'https://api.resend.com/emails');
    assert.equal(call.headers.Authorization, 'Bearer re_test');
    assert.equal(call.headers['Idempotency-Key'], `quote-send-${sendId}`);
    assert.deepEqual(call.body.to, ['michael@example.com']);
    assert.equal(call.body.from, 'Harmony Production <quotes@harmonyproduction.ca>');
    assert.equal(call.body.reply_to, SAMPLE_CONFIG.email);
    assert.match(String(call.body.html), /href="https:\/\/ops\.test\/q\/[A-Za-z0-9_-]+"/);
    const [attachment] = call.body.attachments as { filename: string; content: string }[];
    assert.equal(attachment.filename, `Harmony_Production_Quote_${q.quoteNumber}.pdf`);
    assert.equal(Buffer.from(attachment.content, 'base64').subarray(0, 5).toString(), '%PDF-');

    // The first send is recorded: recipient, sender, kind — nothing else.
    assert.deepEqual(
      sent.emailSends.map((s) => [s.recipientEmail, s.kind, s.sentByEmail]),
      [['michael@example.com', 'first', staff.email]],
    );

    // Sending again reuses the same live link and is recorded as a resend.
    const resent = await send.sendQuoteEmail(q.id, { expectedUpdatedAt: sent.updatedAt, sendId: randomUUID() }, staff, origin, SAMPLE_CONFIG);
    const linkOf = (c: (typeof calls)[number]) => /\/q\/([A-Za-z0-9_-]+)/.exec(String(c.body.html))![1];
    assert.equal(linkOf(calls[1]), linkOf(calls[0]));
    assert.equal(resent.status, 'sent');
    assert.deepEqual(resent.emailSends.map((s) => s.kind), ['resend', 'first']); // newest first

    // The stored rows hold no token or PDF: just these columns.
    const rows = await client.execute({ sql: 'SELECT * FROM quote_email_sends WHERE quote_id = ? ORDER BY id', args: [q.id] });
    assert.equal(rows.rows.length, 2);
    assert.deepEqual(Object.keys(rows.rows[0]).sort(), ['id', 'kind', 'provider_message_id', 'quote_id', 'recipient_email', 'sent_at', 'sent_by_email']);
    assert.equal(rows.rows[0].provider_message_id, 'email-1');
    assert.ok(!JSON.stringify(rows.rows).includes(linkOf(calls[0])), 'the link token is never stored');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the email service’s refusal reaches staff as its own message', { skip: noChrome }, async () => {
  configure(true);
  const q = await newQuote();
  globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'The harmonyproduction.ca domain is not verified.' }), { status: 403 })) as typeof fetch;
  try {
    await assert.rejects(send.sendQuoteEmail(q.id, { expectedUpdatedAt: q.updatedAt, sendId: randomUUID() }, staff, origin, SAMPLE_CONFIG), /domain is not verified/);
    // A refused email is not a send.
    assert.deepEqual((await repo.getQuote(q.id))!.emailSends, []);
  } finally {
    globalThis.fetch = realFetch;
  }
});
