import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accumulate, bucketize, comparedTo, currentPeriod, inPeriod, monthLabel, monthsSince, previousPeriod } from './dateRanges';

test('current periods', () => {
  assert.deepEqual(currentPeriod({ month: '2026-09' }, '2026-09-28'), { start: '2026-09-01', end: '2026-09-28' });
  assert.deepEqual(currentPeriod({ month: '2026-08' }, '2026-09-28'), { start: '2026-08-01', end: '2026-08-31' });
  assert.deepEqual(currentPeriod('3M', '2026-09-28'), { start: '2026-06-29', end: '2026-09-28' });
  assert.deepEqual(currentPeriod('YTD', '2026-09-28'), { start: '2026-01-01', end: '2026-09-28' });
  assert.deepEqual(currentPeriod('1Y', '2026-09-28'), { start: '2025-09-29', end: '2026-09-28' });
  assert.deepEqual(currentPeriod('ALL', '2026-09-28'), { start: null, end: '2026-09-28' });
});

test('previous periods are like-for-like and never overlap the current one', () => {
  // This month so far vs the same days of last month.
  assert.deepEqual(previousPeriod({ month: '2026-09' }, '2026-09-28'), { start: '2026-08-01', end: '2026-08-28' });
  // A whole past month vs the whole month before.
  assert.deepEqual(previousPeriod({ month: '2026-07' }, '2026-09-28'), { start: '2026-06-01', end: '2026-06-30' });
  assert.deepEqual(previousPeriod({ month: '2026-04' }, '2026-09-28'), { start: '2026-03-01', end: '2026-03-31' });
  assert.deepEqual(previousPeriod('YTD', '2026-09-28'), { start: '2025-01-01', end: '2025-09-28' });
  assert.equal(previousPeriod('ALL', '2026-09-28'), null);
  for (const r of [{ month: '2026-09' }, { month: '2026-03' }, '3M', 'YTD', '1Y'] as const) {
    const prev = previousPeriod(r, '2026-09-28')!;
    assert.ok(prev.end < currentPeriod(r, '2026-09-28').start!, JSON.stringify(r));
  }
});

test('month arithmetic clamps to short months and handles year boundaries', () => {
  assert.deepEqual(previousPeriod({ month: '2026-03' }, '2026-03-31'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(previousPeriod({ month: '2028-03' }, '2028-03-31'), { start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(previousPeriod({ month: '2026-01' }, '2026-01-15'), { start: '2025-12-01', end: '2025-12-15' });
  assert.deepEqual(currentPeriod({ month: '2028-02' }, '2028-09-01'), { start: '2028-02-01', end: '2028-02-29' });
});

test('month picker choices and labels', () => {
  assert.deepEqual(monthsSince('2025-11-20', '2026-02-03'), ['2026-02', '2026-01', '2025-12', '2025-11']);
  assert.deepEqual(monthsSince('2026-02-01', '2026-02-03'), ['2026-02']);
  assert.equal(monthLabel('2026-09', '2026-10-01'), 'Sep');
  assert.equal(monthLabel('2025-12', '2026-10-01'), 'Dec 2025');
  assert.equal(comparedTo({ month: '2026-10' }, '2026-10-01'), 'same days last month');
  assert.equal(comparedTo({ month: '2026-01' }, '2026-10-01'), 'December');
  assert.equal(comparedTo('ALL', '2026-10-01'), null);
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
    { date: '2026-09-01', cents: 6500 },
    { date: '2026-09-01', cents: 4250 },
    { date: '2026-09-28', cents: 1 },
    { date: '2026-08-31', cents: 99999 }, // outside September
  ];
  const month = bucketize(entries, { month: '2026-09' }, '2026-09-28');
  assert.equal(month.length, 28);
  assert.equal(month[0].value, 10750);
  assert.equal(month[27].value, 1);
  assert.equal(month.reduce((s, b) => s + b.value, 0), 10751);
  assert.equal(bucketize(entries, { month: '2026-08' }, '2026-09-28').length, 31);
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
