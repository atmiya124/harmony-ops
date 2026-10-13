import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteCreateSchema, quoteStatusInputSchema, quoteUpdateSchema } from './quote';

const ID = '5f0c7c1e-2d3b-4a8e-9f10-1234567890ab';

function valid(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    customerName: 'Michael Smith',
    customerCompany: '',
    customerEmail: 'Michael.Smith@Contact.com',
    customerPhone: '',
    billingAddress: '220 West 53rd Street',
    eventId: null,
    eventName: 'Gala',
    eventDate: null,
    venueName: '',
    venueAddress: '',
    quoteDate: '2026-10-13',
    validUntil: '2026-11-12',
    items: [
      { section: 'LED Display', itemName: 'Outdoor LED Wall P3.9', description: '12 ft x 8 ft', quantity: 1, unitPriceCents: 240000 },
      { section: 'Sound', itemName: 'Wireless Microphones', description: '', quantity: 6, unitPriceCents: 6000 },
    ],
    discountType: 'percent',
    discountValue: 500,
    taxLabel: 'HST',
    taxRateBp: 1300,
    depositType: 'percent',
    depositValue: 5000,
    notes: '',
    terms: 'Terms',
    ...overrides,
  };
}

test('accepts a valid quote and normalises blanks to null', () => {
  const r = quoteCreateSchema.safeParse(valid());
  assert.equal(r.success, true);
  if (!r.success) return;
  assert.equal(r.data.customerCompany, null);
  assert.equal(r.data.customerEmail, 'michael.smith@contact.com');
  assert.equal(r.data.items[1].description, null);
});

test('totals and server-assigned fields sent by the browser are dropped', () => {
  const r = quoteCreateSchema.safeParse(
    valid({
      subtotalCents: 1,
      totalCents: 1,
      taxCents: 1,
      depositRequiredCents: 1,
      quoteNumber: 'Q-999999999',
      status: 'accepted',
      items: [{ section: 'Sound', itemName: 'PA', quantity: 2, unitPriceCents: 1000, lineTotalCents: 1 }],
    }),
  );
  assert.equal(r.success, true);
  if (!r.success) return;
  for (const key of ['subtotalCents', 'totalCents', 'taxCents', 'depositRequiredCents', 'quoteNumber', 'status']) assert.equal(key in r.data, false, key);
  assert.equal('lineTotalCents' in r.data.items[0], false);
});

function omitId<T extends { id: unknown }>(value: T): Omit<T, 'id'> {
  const copy: Partial<T> = { ...value };
  delete copy.id;
  return copy as Omit<T, 'id'>;
}

function issuePaths(input: unknown, schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[] }[] } } } = quoteCreateSchema) {
  const r = schema.safeParse(input);
  assert.equal(r.success, false);
  return r.error!.issues.map((i) => i.path.join('.'));
}

test('rejects bad customer, dates and items', () => {
  assert.deepEqual(issuePaths(valid({ customerName: '  ' })), ['customerName']);
  assert.deepEqual(issuePaths(valid({ customerEmail: 'nope' })), ['customerEmail']);
  assert.deepEqual(issuePaths(valid({ quoteDate: '2026-02-30' })), ['quoteDate']);
  assert.deepEqual(issuePaths(valid({ validUntil: '2026-10-01' })), ['validUntil']);
  assert.deepEqual(issuePaths(valid({ items: [] })), ['items']);
  assert.deepEqual(issuePaths(valid({ items: [{ section: 'A', itemName: 'B', quantity: 0, unitPriceCents: 100 }] })), ['items.0.quantity']);
  assert.deepEqual(issuePaths(valid({ items: [{ section: 'A', itemName: 'B', quantity: 1.5, unitPriceCents: 100 }] })), ['items.0.quantity']);
  assert.deepEqual(issuePaths(valid({ items: [{ section: 'A', itemName: 'B', quantity: 1, unitPriceCents: -1 }] })), ['items.0.unitPriceCents']);
  assert.deepEqual(issuePaths(valid({ items: [{ section: 'A', itemName: 'B', quantity: 1, unitPriceCents: 10.5 }] })), ['items.0.unitPriceCents']);
  assert.deepEqual(issuePaths(valid({ items: [{ section: '', itemName: 'B', quantity: 1, unitPriceCents: 1 }] })), ['items.0.section']);
});

test('rejects bad discount, tax and deposit', () => {
  assert.deepEqual(issuePaths(valid({ discountValue: 10001 })), ['discountValue']);
  assert.deepEqual(issuePaths(valid({ discountType: 'none', discountValue: 5 })), ['discountValue']);
  assert.deepEqual(issuePaths(valid({ discountType: 'fixed', discountValue: 99_999_999 })), ['discountValue']);
  assert.deepEqual(issuePaths(valid({ taxRateBp: 3001 })), ['taxRateBp']);
  assert.deepEqual(issuePaths(valid({ taxRateBp: -1 })), ['taxRateBp']);
  assert.deepEqual(issuePaths(valid({ depositType: 'fixed', depositValue: 99_999_999 })), ['depositValue']);
  assert.deepEqual(issuePaths(valid({ depositType: 'bogus' })), ['depositType']);
});

test('rejects a quote over the $1,000,000 guard rail', () => {
  assert.deepEqual(issuePaths(valid({ items: [{ section: 'A', itemName: 'B', quantity: 2, unitPriceCents: 100_000_000 }] })), ['items']);
});

test('updates need the loaded version; status input only takes manual statuses', () => {
  const rest = omitId(valid());
  assert.equal(quoteUpdateSchema.safeParse({ ...rest, expectedUpdatedAt: '2026-10-13T00:00:00.000Z' }).success, true);
  assert.deepEqual(issuePaths(rest, quoteUpdateSchema), ['expectedUpdatedAt']);
  assert.equal(quoteStatusInputSchema.safeParse({ status: 'sent', expectedUpdatedAt: 'x' }).success, true);
  assert.equal(quoteStatusInputSchema.safeParse({ status: 'converted', expectedUpdatedAt: 'x' }).success, false);
  assert.equal(quoteStatusInputSchema.safeParse({ status: 'bogus', expectedUpdatedAt: 'x' }).success, false);
});
