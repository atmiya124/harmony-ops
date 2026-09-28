import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accumulate, bucketize, currentPeriod, inPeriod, previousPeriod } from './dateRanges';

test('current periods', () => {
  assert.deepEqual(currentPeriod('1W', '2026-09-28'), { start: '2026-09-22', end: '2026-09-28' });
  assert.deepEqual(currentPeriod('1M', '2026-09-28'), { start: '2026-09-01', end: '2026-09-28' });
  assert.deepEqual(currentPeriod('3M', '2026-09-28'), { start: '2026-06-29', end: '2026-09-28' });
  assert.deepEqual(currentPeriod('YTD', '2026-09-28'), { start: '2026-01-01', end: '2026-09-28' });
  assert.deepEqual(currentPeriod('1Y', '2026-09-28'), { start: '2025-09-29', end: '2026-09-28' });
  assert.deepEqual(currentPeriod('ALL', '2026-09-28'), { start: null, end: '2026-09-28' });
});

test('previous periods are like-for-like and never overlap the current one', () => {
  assert.deepEqual(previousPeriod('1W', '2026-09-28'), { start: '2026-09-15', end: '2026-09-21' });
  assert.deepEqual(previousPeriod('1M', '2026-09-28'), { start: '2026-08-01', end: '2026-08-28' });
  assert.deepEqual(previousPeriod('YTD', '2026-09-28'), { start: '2025-01-01', end: '2025-09-28' });
  assert.equal(previousPeriod('ALL', '2026-09-28'), null);
  for (const r of ['1W', '1M', '3M', 'YTD', '1Y'] as const) {
    const prev = previousPeriod(r, '2026-09-28')!;
    assert.ok(prev.end < currentPeriod(r, '2026-09-28').start!, r);
  }
});

test('month arithmetic clamps to short months and handles year boundaries', () => {
  assert.deepEqual(previousPeriod('1M', '2026-03-31'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(previousPeriod('1M', '2028-03-31'), { start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(previousPeriod('1M', '2026-01-15'), { start: '2025-12-01', end: '2025-12-15' });
  assert.deepEqual(currentPeriod('1W', '2026-01-03'), { start: '2025-12-28', end: '2026-01-03' });
});

test('inPeriod is inclusive at both ends', () => {
  const p = { start: '2026-09-01', end: '2026-09-28' };
  assert.equal(inPeriod('2026-09-01', p), true);
  assert.equal(inPeriod('2026-09-28', p), true);
  assert.equal(inPeriod('2026-08-31', p), false);
  assert.equal(inPeriod('2026-09-29', p), false);
});

test('bucketize keeps empty buckets and sums exact cents', () => {
  const entries = [
    { date: '2026-09-22', cents: 6500 },
    { date: '2026-09-22', cents: 4250 },
    { date: '2026-09-28', cents: 1 },
    { date: '2026-09-21', cents: 99999 }, // outside 1W
  ];
  const week = bucketize(entries, '1W', '2026-09-28');
  assert.equal(week.length, 7);
  assert.equal(week[0].value, 10750);
  assert.equal(week[6].value, 1);
  assert.equal(week.reduce((s, b) => s + b.value, 0), 10751);
});

test('bucketize months for YTD, weeks for 3M', () => {
  const entries = [
    { date: '2026-01-05', cents: 100 },
    { date: '2026-09-02', cents: 200 },
  ];
  const ytd = bucketize(entries, 'YTD', '2026-09-28');
  assert.equal(ytd.length, 9);
  assert.equal(ytd[0].label, 'Jan');
  assert.equal(ytd[8].value, 200);
  const q = bucketize(entries, '3M', '2026-09-28');
  assert.equal(q.length, 14);
  assert.equal(q.reduce((s, b) => s + b.value, 0), 200);
});

test('accumulate produces a running total ending at the period sum', () => {
  const running = accumulate([
    { label: 'a', value: 100 },
    { label: 'b', value: 0 },
    { label: 'c', value: 250 },
  ]);
  assert.deepEqual(running.map((b) => b.value), [100, 100, 350]);
  assert.deepEqual(running.map((b) => b.label), ['a', 'b', 'c']);
  assert.deepEqual(accumulate([]), []);
});

test('ALL starts at the earliest entry', () => {
  const all = bucketize([{ date: '2025-11-10', cents: 500 }], 'ALL', '2026-02-01');
  assert.deepEqual(all.map((b) => b.label), ['Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026']);
});
