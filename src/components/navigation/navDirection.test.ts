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

test('expense details sit under Finances; editing stays on the same screen', () => {
  const id = '5f0c7c1e-2d3b-4a8e-9f10-1234567890ab';
  assert.equal(screenLevel(`/expenses/${id}`), 3);
  assert.equal(screenLevel(`/expenses/${id}/edit`), 3);
  assert.equal(parentOf(`/expenses/${id}`), '/finances');
  assert.equal(parentOf(`/expenses/${id}/edit`), `/expenses/${id}`);
  assert.equal(directionBetween('/finances', `/expenses/${id}`), 'forward');
  assert.equal(directionBetween(`/expenses/${id}`, '/finances'), 'back');
  assert.equal(directionBetween('/events/bookings/12', `/expenses/${id}`), 'forward');
  assert.equal(directionBetween(`/expenses/${id}`, `/expenses/${id}/edit`), 'fade');
});

test('siblings crossfade', () => {
  assert.equal(directionBetween('/calculator', '/calculator/stage'), 'fade');
  assert.equal(directionBetween('/events/bookings', '/events/today'), 'fade');
  assert.equal(directionBetween('/finances', '/events/bookings'), 'fade');
});
