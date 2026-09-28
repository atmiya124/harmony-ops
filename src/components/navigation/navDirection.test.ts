import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionBetween, parentOf, screenLevel } from './navDirection';

test('screen depth', () => {
  assert.equal(screenLevel('/'), 0);
  for (const p of ['/finances', '/events/bookings', '/events/today', '/calculator', '/calculator/stage', '/calculator/settings']) assert.equal(screenLevel(p), 1, p);
  assert.equal(screenLevel('/events/bookings/12'), 2);
  assert.equal(screenLevel('/events/bookings/new'), 2);
  assert.equal(screenLevel('/events/bookings/12/edit'), 3);
});

test('opening nested screens pushes, returning pops', () => {
  assert.equal(directionBetween('/', '/calculator'), 'forward');
  assert.equal(directionBetween('/', '/calculator/stage'), 'forward');
  assert.equal(directionBetween('/', '/events/bookings'), 'forward');
  assert.equal(directionBetween('/events/bookings', '/events/bookings/12'), 'forward');
  assert.equal(directionBetween('/events/bookings/12', '/events/bookings/12/edit'), 'forward');
  assert.equal(directionBetween('/calculator', '/'), 'back');
  assert.equal(directionBetween('/events/bookings/12/edit', '/events/bookings/12'), 'back');
  assert.equal(directionBetween('/events/bookings/12', '/events/bookings'), 'back');
});

test('back chevron goes one level up', () => {
  assert.equal(parentOf('/calculator'), '/');
  assert.equal(parentOf('/calculator/stage'), '/');
  assert.equal(parentOf('/calculator/settings'), '/');
  assert.equal(parentOf('/events/bookings/12'), '/events/bookings');
  assert.equal(parentOf('/events/bookings/new'), '/events/bookings');
  assert.equal(parentOf('/events/bookings/12/edit'), '/events/bookings/12');
  assert.equal(directionBetween('/events/bookings/12/edit', parentOf('/events/bookings/12/edit')), 'back');
});

test('siblings crossfade', () => {
  assert.equal(directionBetween('/calculator', '/calculator/stage'), 'fade');
  assert.equal(directionBetween('/events/bookings', '/events/today'), 'fade');
  assert.equal(directionBetween('/finances', '/events/bookings'), 'fade');
});
