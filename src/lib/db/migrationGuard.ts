// This Turso database is shared with Event-booking-app. Harmony Ops may only
// ever ADD: its own tables and indexes, and new columns on tables its own
// migrations created (ALTER TABLE … ADD COLUMN). Nothing is ever dropped,
// renamed or otherwise altered, and the other app's tables are never
// touched. `npm run db:apply` checks every statement against these rules
// before running anything.

// Known shared/other-app tables (the static line of defense). applyMigration
// additionally refuses any statement touching a table that already exists
// in the live database, unless one of our own migrations created it — which
// also covers tables not listed here.
export const SHARED_TABLES = [
  'bookings',
  'booking_equipment',
  'booking_services',
  'partner_settings',
  'users',
  'event_checklists',
  'reminder_logs',
  '__drizzle_migrations',
] as const;

const CREATE_TABLE = /^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?[`"[]?(\w+)[`"\]]?/i;
const CREATE_INDEX = /^CREATE (?:UNIQUE )?INDEX\s+(?:IF NOT EXISTS\s+)?[`"[]?\w+[`"\]]?\s+ON\s+[`"[]?(\w+)[`"\]]?/i;
// ALTER TABLE t ADD [COLUMN] c … — the only ALTER allowed. RENAME, DROP
// COLUMN and the rest don't match, so they're rejected below.
const ADD_COLUMN = /^ALTER TABLE\s+[`"[]?(\w+)[`"\]]?\s+ADD\s+(?:COLUMN\s+)?[`"[]?(\w+)[`"\]]?/i;

export type StatementKind = 'create_table' | 'create_index' | 'add_column';

export function splitMigration(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface StatementCheck {
  statement: string;
  kind: StatementKind | null;
  table: string | null;
  column?: string; // for add_column
  ok: boolean;
  reason?: string;
}

// The table a CREATE TABLE statement creates. applyMigration runs this over
// our own migration files to know which existing tables are ours to extend.
export function createdTable(statement: string): string | null {
  return statement.match(CREATE_TABLE)?.[1] ?? null;
}

export function checkStatement(statement: string): StatementCheck {
  const createTable = statement.match(CREATE_TABLE)?.[1];
  const createIndex = statement.match(CREATE_INDEX)?.[1];
  const addColumn = statement.match(ADD_COLUMN);
  const kind: StatementKind | null = createTable ? 'create_table' : createIndex ? 'create_index' : addColumn ? 'add_column' : null;
  const table = createTable ?? createIndex ?? addColumn?.[1] ?? null;
  if (!kind || !table) {
    return { statement, kind, table, ok: false, reason: 'Only CREATE TABLE, CREATE INDEX and ALTER TABLE … ADD COLUMN statements are allowed on the shared database.' };
  }
  const base = { statement, kind, table, ...(addColumn ? { column: addColumn[2] } : {}) };
  if ((SHARED_TABLES as readonly string[]).includes(table.toLowerCase())) {
    return { ...base, ok: false, reason: `"${table}" belongs to Event-booking-app and must not be modified.` };
  }
  // A foreign key into a shared table would let our constraints block (or
  // cascade from) the other app's deletes — link by id in app code instead.
  const referenced = [...statement.matchAll(/REFERENCES\s+[`"[]?(\w+)[`"\]]?/gi)].map((m) => m[1].toLowerCase());
  const sharedRef = referenced.find((t) => (SHARED_TABLES as readonly string[]).includes(t));
  if (sharedRef) {
    return { ...base, ok: false, reason: `Foreign key to shared table "${sharedRef}" is not allowed; validate the id in app code.` };
  }
  // A single statement must not smuggle a second one after a semicolon.
  if (statement.replace(/;\s*$/, '').includes(';')) {
    return { ...base, ok: false, reason: 'Multiple statements in one chunk.' };
  }
  return { ...base, ok: true };
}

export interface MigrationPlan {
  ok: boolean;
  alreadyApplied?: boolean;
  errors: string[];
  newTables: string[];
  newColumns: string[]; // "table.column"
}

// Decides whether a migration (already passed through checkStatement) is safe
// to run against the live database:
//   - CREATE TABLE: the table must not exist yet.
//   - CREATE INDEX: only on a table this migration creates.
//   - ADD COLUMN: only on an existing table that one of Harmony Ops' own
//     migrations created (`ownTables`), and only a column it doesn't have.
// Table and column names in the sets are lower-case.
export function planMigration(checks: StatementCheck[], existingTables: Set<string>, ownTables: Set<string>, existingColumns: Map<string, Set<string>>): MigrationPlan {
  const lc = (s: string) => s.toLowerCase();
  const newTables = [...new Set(checks.filter((c) => c.kind === 'create_table').map((c) => c.table!))];
  const adds = checks.filter((c) => c.kind === 'add_column');
  const newColumns = adds.map((c) => `${c.table}.${c.column}`);
  const errors: string[] = [];

  const recreated = newTables.filter((t) => existingTables.has(lc(t)));
  const indexElsewhere = [...new Set(checks.filter((c) => c.kind === 'create_index' && !newTables.includes(c.table!)).map((c) => c.table!))];
  const notOurs = [...new Set(adds.filter((c) => !ownTables.has(lc(c.table!))).map((c) => c.table!))];
  const missing = [...new Set(adds.filter((c) => !existingTables.has(lc(c.table!))).map((c) => c.table!))];
  const presentColumns = adds.filter((c) => existingColumns.get(lc(c.table!))?.has(lc(c.column!))).map((c) => `${c.table}.${c.column}`);

  if (indexElsewhere.length) errors.push(`index on a table this migration doesn't create: ${indexElsewhere.join(', ')}`);
  if (notOurs.length) errors.push(`ADD COLUMN on a table Harmony Ops didn't create: ${notOurs.join(', ')}`);
  if (missing.length) errors.push(`ADD COLUMN on a table that doesn't exist: ${missing.join(', ')}`);

  // Everything this migration adds is already there: it ran before.
  const alreadyApplied =
    errors.length === 0 && recreated.length + presentColumns.length > 0 && recreated.length === newTables.length && presentColumns.length === adds.length;
  if (alreadyApplied) return { ok: false, alreadyApplied, errors: [], newTables, newColumns };
  if (recreated.length) errors.push(`table(s) already exist: ${recreated.join(', ')}`);
  if (presentColumns.length) errors.push(`column(s) already exist: ${presentColumns.join(', ')}`);
  return { ok: errors.length === 0, errors, newTables, newColumns };
}
