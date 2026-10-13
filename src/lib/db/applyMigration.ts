// Usage: npm run db:apply -- drizzle/0006_item_discounts.sql [--dry-run]
//
// Applies one migration to the shared Turso database, after checking every
// statement with migrationGuard: new tables and indexes, or new columns on
// tables an earlier Harmony Ops migration created — nothing else. A migration
// whose tables/columns already exist is reported and the run stops, so it's
// never half-applied twice. All statements run in one transaction.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createClient } from '@libsql/client';
import { checkStatement, createdTable, planMigration, splitMigration } from './migrationGuard';

// Tables created by our own migration files, other than the one being run.
function ownTables(file: string): Set<string> {
  const dir = dirname(file);
  const tables = new Set<string>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql') && f !== basename(file))) {
    for (const statement of splitMigration(readFileSync(join(dir, f), 'utf8'))) {
      const table = createdTable(statement);
      if (table) tables.add(table.toLowerCase());
    }
  }
  return tables;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  if (!file) throw new Error('Pass the migration file, e.g. npm run db:apply -- drizzle/0006_item_discounts.sql');

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

  const existingRows = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  const existingTables = new Set(existingRows.rows.map((r) => String(r.name).toLowerCase()));
  const existingColumns = new Map<string, Set<string>>();
  for (const table of new Set(checks.filter((c) => c.kind === 'add_column').map((c) => c.table!.toLowerCase()))) {
    if (!existingTables.has(table)) continue;
    const cols = await client.execute({ sql: 'SELECT name FROM pragma_table_info(?)', args: [table] });
    existingColumns.set(table, new Set(cols.rows.map((r) => String(r.name).toLowerCase())));
  }

  const plan = planMigration(checks, existingTables, ownTables(file), existingColumns);
  if (plan.alreadyApplied) {
    console.error('Already applied? Everything this migration adds exists. Nothing was changed.');
    process.exit(1);
  }
  if (!plan.ok) {
    for (const e of plan.errors) console.error(`REJECTED: ${e}`);
    console.error('Nothing was changed.');
    process.exit(1);
  }

  console.log(`${statements.length} statements.`);
  if (plan.newTables.length) console.log(`Creating tables: ${plan.newTables.join(', ')}`);
  if (plan.newColumns.length) console.log(`Adding columns: ${plan.newColumns.join(', ')}`);
  const touched = new Set([...plan.newTables, ...plan.newColumns.map((c) => c.split('.')[0])].map((t) => t.toLowerCase()));
  console.log(`Other tables left untouched: ${[...existingTables].filter((t) => !t.startsWith('sqlite_') && !touched.has(t)).sort().join(', ')}`);
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
