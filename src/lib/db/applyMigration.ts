// Usage: npm run db:apply -- drizzle/0003_auth_tables.sql [--dry-run]
//
// Applies one generated migration to the shared Turso database, after
// checking every statement with migrationGuard (additive, Harmony Ops tables
// only). Tables that already exist are reported and the run stops, so a
// migration is never half-applied twice. All statements run in one
// transaction.
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { checkStatement, splitMigration } from './migrationGuard';

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  if (!file) throw new Error('Pass the migration file, e.g. npm run db:apply -- drizzle/0003_auth_tables.sql');

  const statements = splitMigration(readFileSync(file, 'utf8'));
  const checks = statements.map(checkStatement);
  const rejected = checks.filter((c) => !c.ok);
  if (rejected.length > 0) {
    for (const c of rejected) console.error(`REJECTED: ${c.reason}\n  ${c.statement.split('\n')[0]}`);
    process.exit(1);
  }

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('TURSO_DATABASE_URL is not set.');
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  const newTables = [...new Set(checks.filter((c) => /^CREATE TABLE/i.test(c.statement)).map((c) => c.table!))];

  // Every statement must target a table that does not exist yet — this is
  // what keeps the other app's tables safe, including ones we don't know by
  // name. (An index on a brand-new table is fine; on an existing one, not.)
  const existingRows = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  const existingTables = new Set(existingRows.rows.map((r) => String(r.name).toLowerCase()));
  const touchingExisting = [...new Set(checks.map((c) => c.table!).filter((t) => existingTables.has(t.toLowerCase())))];
  if (touchingExisting.length > 0) {
    const alreadyApplied = touchingExisting.every((t) => newTables.includes(t));
    console.error(
      alreadyApplied
        ? `Already applied? These tables exist: ${touchingExisting.join(', ')}. Nothing was changed.`
        : `REJECTED: this migration touches existing table(s): ${touchingExisting.join(', ')}. Nothing was changed.`,
    );
    process.exit(1);
  }
  const indexOnly = [...new Set(checks.map((c) => c.table!).filter((t) => !newTables.includes(t)))];
  if (indexOnly.length > 0) {
    console.error(`REJECTED: index on a table this migration doesn't create: ${indexOnly.join(', ')}. Nothing was changed.`);
    process.exit(1);
  }

  console.log(`${statements.length} statements, creating: ${newTables.join(', ')}`);
  console.log(`Existing tables left untouched: ${[...existingTables].filter((t) => !t.startsWith('sqlite_')).sort().join(', ')}`);
  if (dryRun) {
    console.log('Dry run — nothing was changed.');
    return;
  }
  await client.batch(statements, 'write');
  console.log('Applied.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
