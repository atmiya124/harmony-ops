import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupCustomers, type CustomerSource } from './customers';

let n = 0;
function quote(o: Partial<CustomerSource>): CustomerSource {
  n++;
  return {
    id: `q${n}`,
    quoteNumber: `Q-${String(n).padStart(9, '0')}`,
    status: 'draft',
    quoteDate: '2026-10-01',
    eventName: null,
    totalCents: 1000,
    customerName: 'Someone',
    customerCompany: null,
    customerEmail: null,
    customerPhone: null,
    clientType: 'regular',
    ...o,
  };
}

test('quotes with the same email (any case) are one customer; details from the newest quote', () => {
  const list = groupCustomers([
    quote({ customerName: 'Fred A', customerEmail: 'FRED@x.com', quoteDate: '2026-09-01', customerPhone: '416-555-0100' }),
    quote({ customerName: 'Fred Antwi', customerEmail: 'fred@x.com', quoteDate: '2026-10-17', clientType: 'contract' }),
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Fred Antwi');
  assert.equal(list[0].clientType, 'contract');
  assert.equal(list[0].lastQuoteDate, '2026-10-17');
  assert.equal(list[0].phone, '416-555-0100', 'gaps filled from older quotes');
  assert.deepEqual(list[0].quotes.map((q) => q.quoteDate), ['2026-10-17', '2026-09-01']);
});

test('without an email, the same name (ignoring case and spacing) is one customer', () => {
  const list = groupCustomers([quote({ customerName: 'Jasmine  Soodeen', quoteDate: '2026-10-14' }), quote({ customerName: 'jasmine soodeen', quoteDate: '2026-08-01' }), quote({ customerName: 'Makinde' })]);
  assert.deepEqual(
    list.map((c) => [c.name, c.quotes.length]),
    [
      ['Jasmine Soodeen', 2],
      ['Makinde', 1],
    ],
  );
});

test('different emails are different customers even with the same name; sorted by name', () => {
  const list = groupCustomers([quote({ customerName: 'Alex', customerEmail: 'a@x.com' }), quote({ customerName: 'alex', customerEmail: 'b@x.com' }), quote({ customerName: 'Bea' })]);
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((c) => c.name.toLowerCase()), ['alex', 'alex', 'bea']);
});
