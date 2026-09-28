import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedFields } from './audit';

test('lists only real field changes, ignoring bookkeeping', () => {
  const before = { amountCents: 6500, category: 'food', notes: null, updatedAt: 'a', updatedByEmail: 'x' };
  const after = { amountCents: 6000, category: 'food', notes: 'fixed typo', updatedAt: 'b', updatedByEmail: 'y' };
  assert.deepEqual(changedFields(before, after), [
    { field: 'amountCents', before: 6500, after: 6000 },
    { field: 'notes', before: null, after: 'fixed typo' },
  ]);
});

test('create and delete snapshots', () => {
  assert.equal(changedFields(null, { amountCents: 1 }).length, 1);
  assert.deepEqual(changedFields({ deletedAt: null }, { deletedAt: '2026-09-28' }), [{ field: 'deletedAt', before: null, after: '2026-09-28' }]);
  assert.deepEqual(changedFields({ a: 1 }, { a: 1 }), []);
});
