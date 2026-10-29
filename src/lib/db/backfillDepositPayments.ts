// Usage: npm run db:backfill-deposits [-- --dry-run]
//
// One-off, after migration 0014 (invoice_payments): an invoice converted
// before payments existed has its deposit in invoices.deposit_paid_cents
// but no payment row, so it would be missing from the payments list and
// from Finances. This adds the missing deposit row, dated the invoice date
// with no method (the deposit form didn't ask for one then). Safe to run
// again: an invoice whose deposit rows already add up is left alone.
import { randomUUID } from 'node:crypto';
import { createClient, type Client } from '@libsql/client';

export interface DepositBackfill {
  invoiceId: string;
  invoiceNumber: string;
  missingCents: number;
}

export async function backfillDepositPayments(client: Client, dryRun: boolean): Promise<DepositBackfill[]> {
  const rows = await client.execute(`
    SELECT i.id, i.invoice_number, i.invoice_date, i.created_at, i.created_by_user_id, i.created_by_email,
           i.deposit_paid_cents - COALESCE((SELECT SUM(p.amount_cents) FROM invoice_payments p
             WHERE p.invoice_id = i.id AND p.kind = 'deposit' AND p.voided_at IS NULL), 0) AS missing
    FROM invoices i
    WHERE i.deleted_at IS NULL`);
  const todo = rows.rows.filter((r) => Number(r.missing) > 0);
  if (!dryRun && todo.length > 0) {
    await client.batch(
      todo.map((r) => ({
        sql: `INSERT INTO invoice_payments (id, invoice_id, kind, amount_cents, method, received_on, reference, recorded_by_user_id, recorded_by_email, created_at)
              VALUES (?, ?, 'deposit', ?, NULL, ?, NULL, ?, ?, ?)`,
        args: [randomUUID(), String(r.id), Number(r.missing), String(r.invoice_date), String(r.created_by_user_id), String(r.created_by_email), String(r.created_at)],
      })),
      'write',
    );
  }
  return todo.map((r) => ({ invoiceId: String(r.id), invoiceNumber: String(r.invoice_number), missingCents: Number(r.missing) }));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('TURSO_DATABASE_URL is not set.');
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const done = await backfillDepositPayments(client, dryRun);
  if (done.length === 0) console.log('Nothing to backfill: every deposit already has its payment row.');
  for (const d of done) console.log(`${dryRun ? 'Would add' : 'Added'} deposit payment of $${(d.missingCents / 100).toFixed(2)} to ${d.invoiceNumber}`);
  if (dryRun) console.log('Dry run — nothing was changed.');
}

if (process.argv[1]?.endsWith('backfillDepositPayments.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
