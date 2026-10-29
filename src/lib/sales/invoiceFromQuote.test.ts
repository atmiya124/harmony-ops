import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarDays, convertBlocker, defaultInvoiceDueDate } from './invoiceFromQuote';

test('due date: a regular client pays on the event day, or today when it has passed or is unknown', () => {
  assert.equal(defaultInvoiceDueDate({ clientType: 'regular', eventDate: '2026-11-20' }, '2026-10-29'), '2026-11-20');
  assert.equal(defaultInvoiceDueDate({ clientType: 'regular', eventDate: '2026-10-01' }, '2026-10-29'), '2026-10-29');
  assert.equal(defaultInvoiceDueDate({ clientType: 'regular', eventDate: null }, '2026-10-29'), '2026-10-29');
});

test('due date: a contract client gets 30 days, across a month end', () => {
  assert.equal(defaultInvoiceDueDate({ clientType: 'contract', eventDate: '2026-11-20' }, '2026-10-29'), '2026-11-28');
  assert.equal(addCalendarDays('2026-12-15', 30), '2027-01-14');
});

test('only an accepted quote can be converted', () => {
  assert.equal(convertBlocker('accepted'), null);
  assert.match(convertBlocker('converted')!, /already been converted/);
  for (const s of ['draft', 'sent', 'viewed', 'declined', 'expired', 'cancelled'] as const) assert.match(convertBlocker(s)!, /Only an accepted quote/);
});
