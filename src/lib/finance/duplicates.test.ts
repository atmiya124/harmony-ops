import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLikelyDuplicate } from './duplicates';

const e = (id: string, amountCents: number, expenseDate: string, deletedAt: string | null = null) => ({ id, amountCents, expenseDate, deletedAt });
const recent = [e('a', 6500, '2026-09-25'), e('b', 4250, '2026-09-24'), e('c', 9900, '2026-09-20', '2026-09-21T00:00:00Z')];

test('same amount on the same or an adjacent day is flagged', () => {
  assert.equal(findLikelyDuplicate({ amountCents: 6500, expenseDate: '2026-09-25' }, recent)?.id, 'a');
  assert.equal(findLikelyDuplicate({ amountCents: 6500, expenseDate: '2026-09-26' }, recent)?.id, 'a');
  assert.equal(findLikelyDuplicate({ amountCents: 6500, expenseDate: '2026-09-24' }, recent)?.id, 'a');
});

test('works across month boundaries', () => {
  assert.equal(findLikelyDuplicate({ amountCents: 100, expenseDate: '2026-10-01' }, [e('x', 100, '2026-09-30')])?.id, 'x');
});

test('different amount, 2+ days apart, deleted, or itself -> no warning', () => {
  assert.equal(findLikelyDuplicate({ amountCents: 6501, expenseDate: '2026-09-25' }, recent), null);
  assert.equal(findLikelyDuplicate({ amountCents: 6500, expenseDate: '2026-09-27' }, recent), null);
  assert.equal(findLikelyDuplicate({ amountCents: 9900, expenseDate: '2026-09-20' }, recent), null);
  assert.equal(findLikelyDuplicate({ id: 'a', amountCents: 6500, expenseDate: '2026-09-25' }, recent), null);
});

test('incomplete input -> no warning', () => {
  assert.equal(findLikelyDuplicate({ amountCents: 0, expenseDate: '2026-09-25' }, recent), null);
  assert.equal(findLikelyDuplicate({ amountCents: 6500, expenseDate: '' }, recent), null);
});
