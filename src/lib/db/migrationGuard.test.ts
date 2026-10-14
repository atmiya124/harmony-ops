import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkStatement, planMigration, splitMigration } from './migrationGuard';

test('the auth migration is purely additive and passes the guard', () => {
  const sql = readFileSync(join(process.cwd(), 'drizzle/0003_auth_tables.sql'), 'utf8');
  const checks = splitMigration(sql).map(checkStatement);
  assert.ok(checks.length > 0);
  for (const c of checks) assert.equal(c.ok, true, `${c.reason}: ${c.statement}`);
  assert.deepEqual([...new Set(checks.map((c) => c.table))].sort(), ['auth_account', 'auth_session', 'auth_user', 'auth_verification']);
});

test('the finance migration is purely additive and never references shared tables', () => {
  const sql = readFileSync(join(process.cwd(), 'drizzle/0004_finance_tables.sql'), 'utf8');
  const checks = splitMigration(sql).map(checkStatement);
  for (const c of checks) assert.equal(c.ok, true, `${c.reason}: ${c.statement}`);
  assert.deepEqual([...new Set(checks.map((c) => c.table))].sort(), ['attachments', 'event_financials', 'expenses', 'finance_audit_log', 'finance_settings', 'reimbursements']);
  assert.ok(!/REFERENCES\s+`?bookings/i.test(sql));
});

test('rejects foreign keys into shared tables', () => {
  assert.equal(checkStatement('CREATE TABLE `x` (`booking_id` integer REFERENCES `bookings`(`id`))').ok, false);
  assert.equal(checkStatement('CREATE TABLE `x` (`b` integer, FOREIGN KEY (`b`) REFERENCES bookings(`id`) ON DELETE cascade)').ok, false);
  assert.equal(checkStatement('CREATE TABLE `x` (`u` integer REFERENCES `users`(`id`))').ok, false);
  // References between our own new tables are fine.
  assert.equal(checkStatement('CREATE TABLE `x` (`a` text REFERENCES `attachments`(`id`))').ok, true);
});

test('rejects anything that alters, drops or touches shared tables', () => {
  const rejected = [
    'ALTER TABLE `bookings` ADD `agreed_amount` integer',
    'DROP TABLE `users`',
    'DROP TABLE `auth_user`',
    'CREATE TABLE `users` (`id` integer)',
    'CREATE TABLE IF NOT EXISTS bookings (id integer)',
    'CREATE INDEX `x` ON `bookings` (`event_date`)',
    'CREATE UNIQUE INDEX `x` ON `Partner_Settings` (`id`)',
    'INSERT INTO `auth_user` VALUES (1)',
    'PRAGMA foreign_keys=OFF',
    'CREATE TABLE `ok` (`id` integer); DROP TABLE `bookings`',
  ];
  for (const s of rejected) assert.equal(checkStatement(s).ok, false, s);
});

test('ADD COLUMN is allowed in form; other ALTERs are not', () => {
  const add = checkStatement('ALTER TABLE `quote_items` ADD `discount_cents` integer DEFAULT 0 NOT NULL');
  assert.equal(add.ok, true);
  assert.equal(add.kind, 'add_column');
  assert.equal(add.table, 'quote_items');
  assert.equal(add.column, 'discount_cents');
  assert.equal(checkStatement('ALTER TABLE quotes ADD COLUMN notes2 text').ok, true);
  for (const s of [
    'ALTER TABLE `quotes` RENAME TO `q2`',
    'ALTER TABLE `quotes` RENAME COLUMN `notes` TO `n`',
    'ALTER TABLE `quotes` DROP COLUMN `notes`',
    'ALTER TABLE `bookings` ADD COLUMN `x` text',
    'ALTER TABLE `quotes` ADD `b` integer REFERENCES `bookings`(`id`)',
  ]) {
    assert.equal(checkStatement(s).ok, false, s);
  }
});

test('the item-discount migration only adds columns to our own item tables', () => {
  const checks = splitMigration(readFileSync(join(process.cwd(), 'drizzle/0006_item_discounts.sql'), 'utf8')).map(checkStatement);
  for (const c of checks) assert.equal(c.ok, true, `${c.reason}: ${c.statement}`);
  assert.ok(checks.every((c) => c.kind === 'add_column'));
  assert.deepEqual([...new Set(checks.map((c) => c.table))].sort(), ['invoice_items', 'quote_items']);
});

test('planMigration: new columns only on existing tables Harmony Ops created', () => {
  const existing = new Set(['quotes', 'quote_items', 'bookings', 'mystery_table']);
  const own = new Set(['quotes', 'quote_items']);
  const cols = new Map([['quote_items', new Set(['id', 'quantity'])]]);
  const plan = (...sql: string[]) => planMigration(sql.map(checkStatement), existing, own, cols);

  const ok = plan('ALTER TABLE quote_items ADD discount_cents integer');
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.newColumns, ['quote_items.discount_cents']);

  // A table we didn't create (e.g. one the other app added that isn't listed).
  assert.equal(plan('ALTER TABLE mystery_table ADD x integer').ok, false);
  // A table that doesn't exist.
  assert.equal(planMigration([checkStatement('ALTER TABLE ghost ADD x integer')], existing, new Set(['ghost']), cols).ok, false);
  // Run twice: reported as already applied, not re-run.
  const again = plan('ALTER TABLE quote_items ADD quantity integer');
  assert.equal(again.ok, false);
  assert.equal(again.alreadyApplied, true);
  // The old rules still hold for tables and indexes.
  assert.equal(plan('CREATE TABLE `quotes` (`id` text)').alreadyApplied, true);
  assert.equal(plan('CREATE INDEX `i` ON `quotes` (`id`)').ok, false);
  assert.equal(plan('CREATE TABLE `fresh` (`id` text)', 'CREATE INDEX `i` ON `fresh` (`id`)').ok, true);
});

test('the quote email history migration only creates its own table and index', () => {
  const checks = splitMigration(readFileSync(join(process.cwd(), 'drizzle/0009_quote_email_sends.sql'), 'utf8')).map(checkStatement);
  for (const c of checks) assert.equal(c.ok, true, `${c.reason}: ${c.statement}`);
  assert.deepEqual(checks.map((c) => [c.kind, c.table]), [
    ['create_table', 'quote_email_sends'],
    ['create_index', 'quote_email_sends'],
  ]);
});
