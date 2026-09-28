import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkStatement, splitMigration } from './migrationGuard';

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
