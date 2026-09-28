import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath } from './redirect';

test('keeps same-origin paths with their query', () => {
  assert.equal(safeNextPath('/events/bookings/12'), '/events/bookings/12');
  assert.equal(safeNextPath('/events?tab=today'), '/events?tab=today');
});

test('falls back to / for anything that could leave the site', () => {
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com', 'javascript:alert(1)', '', undefined, null]) {
    assert.equal(safeNextPath(bad), '/', String(bad));
  }
});

test('does not bounce back to the login page or an API route', () => {
  assert.equal(safeNextPath('/login'), '/');
  assert.equal(safeNextPath('/login?next=/x'), '/');
  assert.equal(safeNextPath('/api/bookings'), '/');
});

test('uses the first value when the param is repeated', () => {
  assert.equal(safeNextPath(['/calculator', '//evil.com']), '/calculator');
});
