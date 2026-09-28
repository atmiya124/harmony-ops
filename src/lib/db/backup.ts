// Usage: npm run db:backup
//
// Read-only SQL dump of the whole Turso database (including the tables owned
// by Event-booking-app) into backups/<timestamp>.sql, in the same shape as
// `sqlite3 .dump`: schema, then every row as an INSERT, in one transaction.
// Only SELECTs are issued against the database. The dump is then restored
// into a throwaway in-memory database and row counts are compared table by
// table, so a backup is only reported OK once it has been proven to restore.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@libsql/client';

// Turso/SQLite internals that are recreated automatically (sqlite_sequence
// rows are still dumped, as `.dump` does).
const isInternal = (name: string) => name.startsWith('sqlite_') || name.startsWith('libsql_') || name.startsWith('_litestream');

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `X'${Buffer.from(bytes).toString('hex')}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('TURSO_DATABASE_URL is not set.');
  // bigint mode so large integers (e.g. millisecond timestamps, ids) can't
  // lose precision on the way through JavaScript numbers.
  const src = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN, intMode: 'bigint' });

  const schema = await src.execute(
    "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, name",
  );
  const tables = schema.rows.filter((r) => r.type === 'table' && !isInternal(String(r.name)));
  const others = schema.rows.filter((r) => r.type !== 'table' && !isInternal(String(r.name)) && !isInternal(String(r.tbl_name)));

  const lines: string[] = [
    `-- Harmony Ops database backup, ${new Date().toISOString()}`,
    `-- Source: ${new URL(url.replace(/^libsql:/, 'https:')).host}`,
    'PRAGMA foreign_keys=OFF;',
    'BEGIN TRANSACTION;',
  ];
  const counts: Record<string, number> = {};

  for (const t of tables) {
    const name = String(t.name);
    lines.push(`${String(t.sql)};`);
    const rows = await src.execute(`SELECT * FROM ${quoteIdent(name)}`);
    counts[name] = rows.rows.length;
    const cols = rows.columns.map(quoteIdent).join(',');
    for (const row of rows.rows) {
      lines.push(`INSERT INTO ${quoteIdent(name)} (${cols}) VALUES(${rows.columns.map((_, i) => sqlLiteral(row[i])).join(',')});`);
    }
  }

  const hasSequence = schema.rows.some((r) => r.name === 'sqlite_sequence');
  if (hasSequence) {
    const seq = await src.execute('SELECT name, seq FROM sqlite_sequence');
    lines.push('DELETE FROM sqlite_sequence;');
    for (const r of seq.rows) lines.push(`INSERT INTO sqlite_sequence VALUES(${sqlLiteral(r.name)},${sqlLiteral(r.seq)});`);
  }
  for (const o of others) lines.push(`${String(o.sql)};`);
  lines.push('COMMIT;', '');

  const dump = lines.join('\n');
  const dir = join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `turso-${stamp}.sql`);
  writeFileSync(file, dump);

  // Prove it restores: replay into a throwaway in-memory database and
  // compare counts.
  const verify = createClient({ url: ':memory:' });
  try {
    await verify.executeMultiple(dump);
    const mismatches: string[] = [];
    for (const [name, expected] of Object.entries(counts)) {
      const got = Number((await verify.execute(`SELECT count(*) AS n FROM ${quoteIdent(name)}`)).rows[0].n);
      if (got !== expected) mismatches.push(`${name}: source ${expected}, restored ${got}`);
    }
    if (mismatches.length) throw new Error(`Restore check FAILED:\n  ${mismatches.join('\n  ')}`);
  } finally {
    verify.close();
  }

  console.log(`Backup written: ${file}`);
  console.log(`SHA-256: ${createHash('sha256').update(dump).digest('hex')}`);
  console.log(`Size: ${(Buffer.byteLength(dump) / 1024).toFixed(1)} KB`);
  console.table(Object.entries(counts).map(([table, rows]) => ({ table, rows })));
  console.log(`Indexes/views/triggers: ${others.length}. Restore check: OK (every table's row count matches).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

