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
