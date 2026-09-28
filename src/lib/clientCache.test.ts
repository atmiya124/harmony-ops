import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearCache, invalidateCache, loadCached, peekCache, setCache, updateCache } from './clientCache';

beforeEach(() => clearCache());

test('loadCached stores the result for the next visit', async () => {
  assert.equal(peekCache('bookings'), undefined);
  await loadCached('bookings', async () => [1, 2]);
  assert.deepEqual(peekCache('bookings'), [1, 2]);
});

test('concurrent loads of the same key share one request', async () => {
  let calls = 0;
  const loader = () => new Promise<number>((r) => setTimeout(() => r(++calls), 10));
  const [a, b] = await Promise.all([loadCached('k', loader), loadCached('k', loader)]);
  assert.equal(calls, 1);
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test('a failed load keeps the last good value', async () => {
  setCache('k', 'old');
  await assert.rejects(loadCached('k', async () => Promise.reject(new Error('offline'))));
  assert.equal(peekCache('k'), 'old');
});

test('a failed load does not block the next try', async () => {
  await assert.rejects(loadCached('k', async () => Promise.reject(new Error('offline'))));
  assert.equal(await loadCached('k', async () => 'ok'), 'ok');
});

test('updateCache changes only existing entries', () => {
  updateCache<number[]>('missing', (v) => [...v, 1]);
  assert.equal(peekCache('missing'), undefined);
  setCache('list', [1]);
  updateCache<number[]>('list', (v) => [...v, 2]);
  assert.deepEqual(peekCache('list'), [1, 2]);
});

test('invalidateCache removes keys by prefix', () => {
  setCache('expenses:a', 1);
  setCache('expenses:b', 2);
  setCache('bookings', 3);
  invalidateCache('expenses:');
  assert.equal(peekCache('expenses:a'), undefined);
  assert.equal(peekCache('expenses:b'), undefined);
  assert.equal(peekCache('bookings'), 3);
});
