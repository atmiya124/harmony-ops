// This Turso database is shared with Event-booking-app. Harmony Ops may only
// ever ADD its own tables and indexes — never alter, drop or rename anything,
// and never touch the tables the other app owns. `npm run db:apply` checks
// every statement against these rules before running anything.

// Known shared/other-app tables (the static line of defense). applyMigration
// additionally refuses any statement touching a table that already exists
// in the live database, which also covers tables not listed here.
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

export function splitMigration(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface StatementCheck {
  statement: string;
  table: string | null;
  ok: boolean;
  reason?: string;
}

export function checkStatement(statement: string): StatementCheck {
  const table = statement.match(CREATE_TABLE)?.[1] ?? statement.match(CREATE_INDEX)?.[1] ?? null;
  if (!table) {
    return { statement, table, ok: false, reason: 'Only CREATE TABLE / CREATE INDEX statements are allowed on the shared database.' };
  }
  if ((SHARED_TABLES as readonly string[]).includes(table.toLowerCase())) {
    return { statement, table, ok: false, reason: `"${table}" belongs to Event-booking-app and must not be modified.` };
  }
  // A foreign key into a shared table would let our constraints block (or
  // cascade from) the other app's deletes — link by id in app code instead.
  const referenced = [...statement.matchAll(/REFERENCES\s+[`"[]?(\w+)[`"\]]?/gi)].map((m) => m[1].toLowerCase());
  const sharedRef = referenced.find((t) => (SHARED_TABLES as readonly string[]).includes(t));
  if (sharedRef) {
    return { statement, table, ok: false, reason: `Foreign key to shared table "${sharedRef}" is not allowed; validate the id in app code.` };
  }
  // A single statement must not smuggle a second one after a semicolon.
  if (statement.replace(/;\s*$/, '').includes(';')) {
    return { statement, table, ok: false, reason: 'Multiple statements in one chunk.' };
  }
  return { statement, table, ok: true };
}
