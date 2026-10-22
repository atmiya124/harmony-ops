import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionBetween, parentOf, safeBackPath, sameScreen, screenLevel } from './navDirection';

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

test('an expense and its edit sheet are one screen', () => {
  assert.equal(sameScreen('/expenses/a', '/expenses/a/edit'), true);
  assert.equal(sameScreen('/expenses/a/edit', '/expenses/a'), true);
  assert.equal(sameScreen('/expenses/a', '/expenses/b'), false);
  assert.equal(sameScreen('/events/bookings', '/events/bookings/12'), false);
  assert.equal(sameScreen('/events/bookings/12', '/events/bookings/12/edit'), false);
});

test('quotes: list → details → edit, and back up the same way', () => {
  const id = '5f0c7c1e-2d3b-4a8e-9f10-1234567890ab';
  assert.equal(screenLevel('/quotes'), 1);
  assert.equal(screenLevel('/invoices'), 1);
  assert.equal(screenLevel('/quotes/new'), 2);
  assert.equal(screenLevel(`/quotes/${id}`), 2);
  assert.equal(screenLevel(`/quotes/${id}/edit`), 3);
  assert.equal(parentOf('/quotes'), '/');
  assert.equal(parentOf('/quotes/new'), '/quotes');
  assert.equal(parentOf(`/quotes/${id}`), '/quotes');
  assert.equal(parentOf(`/quotes/${id}/edit`), `/quotes/${id}`);
  assert.equal(parentOf(`/invoices/${id}`), '/invoices');
  assert.equal(directionBetween('/quotes', `/quotes/${id}`), 'forward');
  assert.equal(directionBetween(`/quotes/${id}`, `/quotes/${id}/edit`), 'forward');
  assert.equal(directionBetween(`/quotes/${id}/edit`, `/quotes/${id}`), 'back');
  assert.equal(directionBetween('/quotes', '/invoices'), 'fade');
  assert.equal(directionBetween('/finances', '/quotes'), 'fade');
});

test('siblings crossfade', () => {
  assert.equal(directionBetween('/calculator', '/calculator/stage'), 'fade');
  assert.equal(directionBetween('/events/bookings', '/events/today'), 'fade');
  assert.equal(directionBetween('/finances', '/events/bookings'), 'fade');
});

test('a partner page sits under Finances, above the expenses it lists', () => {
  const partner = '/finances/partners/a%40example.com';
  assert.equal(screenLevel(partner), 2.5);
  assert.equal(parentOf(partner), '/finances');
  assert.equal(directionBetween('/finances', partner), 'forward');
  assert.equal(directionBetween(partner, '/finances'), 'back');
  assert.equal(directionBetween(partner, '/expenses/abc'), 'forward');
});

test("the Finances cards' detail pages sit under Finances", () => {
  for (const page of ['/finances/events', '/finances/owed', '/finances/crew']) {
    assert.equal(screenLevel(page), 2, page);
    assert.equal(parentOf(page), '/finances', page);
    assert.equal(directionBetween('/finances', page), 'forward', page);
    assert.equal(directionBetween(page, '/expenses/abc'), 'forward', page);
    assert.equal(directionBetween(page, '/finances/partners/a%40b.c'), 'forward', page);
  }
});

test('Back can be pointed only at in-app Finances paths', () => {
  assert.equal(safeBackPath('/finances/owed'), '/finances/owed');
  assert.equal(safeBackPath('/finances/events?range=2026-10'), '/finances/events?range=2026-10');
  for (const bad of [null, '', 'https://evil.example', '//evil.example', '/quotes', '/finances/../login', 'javascript:alert(1)']) {
    assert.equal(safeBackPath(bad), null, String(bad));
  }
});

test('a crew profile sits under Crew, above the labour it links to', () => {
  const person = '/finances/crew/3f0b8c1e-2d4a-4c6b-9e8f-1a2b3c4d5e6f';
  assert.equal(screenLevel(person), 2.5);
  assert.equal(parentOf(person), '/finances/crew');
  assert.equal(directionBetween('/finances/crew', person), 'forward');
  assert.equal(directionBetween(person, '/expenses/abc'), 'forward');
  assert.equal(safeBackPath(person), person);
});
