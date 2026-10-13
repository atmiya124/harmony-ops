import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustmentCents, calculateQuoteTotals, lineTotalCents } from './quoteCalculator';

const NONE = { type: 'none', value: 0 } as const;

// The line items from the Harmony Production reference quote (Q-000000218).
const REFERENCE_ITEMS = [
  [1, 240000],
  [1, 160000],
  [4, 15000],
  [1, 65000],
  [1, 220000],
  [1, 45000],
  [6, 6000],
  [4, 8000],
  [1, 55000],
  [1, 180000],
  [1, 125000],
  [1, 30000],
  [10, 3500],
  [12, 7500],
  [24, 2000],
  [2, 9000],
  [1, 60000],
  [1, 90000],
  [1, 35000],
].map(([quantity, unitPriceCents]) => ({ quantity, unitPriceCents }));

test('line total is quantity × unit price', () => {
  assert.equal(lineTotalCents(4, 15000), 60000);
  assert.equal(lineTotalCents(1, 0), 0);
  assert.throws(() => lineTotalCents(1.5, 100));
  assert.throws(() => lineTotalCents(1, -1));
});

test('reference quote: subtotal, 5% discount, 13% HST on the discounted amount, 50% deposit', () => {
  const t = calculateQuoteTotals({
    items: REFERENCE_ITEMS,
    discount: { type: 'percent', value: 500 },
    taxRateBp: 1300,
    deposit: { type: 'percent', value: 5000 },
  });
  assert.equal(t.subtotalCents, 1_624_000); // $16,240.00, as on the PDF
  assert.equal(t.discountCents, 81_200); // $812.00, as on the PDF
  assert.equal(t.taxableCents, 1_542_800);
  assert.equal(t.taxCents, 200_564); // 13% of $15,428.00
  assert.equal(t.totalCents, 1_743_364);
  assert.equal(t.depositRequiredCents, 871_682);
  assert.equal(t.lineTotalsCents.length, REFERENCE_ITEMS.length);
});

test('no discount, no tax, no deposit', () => {
  const t = calculateQuoteTotals({ items: [{ quantity: 2, unitPriceCents: 12345 }], discount: NONE, taxRateBp: 0, deposit: NONE });
  assert.deepEqual(t, {
    lineTotalsCents: [24690],
    lineDiscountsCents: [0],
    lineNetCents: [24690],
    itemDiscountsCents: 0,
    subtotalCents: 24690,
    discountCents: 0,
    taxableCents: 24690,
    taxCents: 0,
    totalCents: 24690,
    depositRequiredCents: 0,
  });
});

test('fixed discount and fixed deposit', () => {
  const t = calculateQuoteTotals({
    items: [{ quantity: 1, unitPriceCents: 100000 }],
    discount: { type: 'fixed', value: 10000 },
    taxRateBp: 1300,
    deposit: { type: 'fixed', value: 50000 },
  });
  assert.equal(t.taxableCents, 90000);
  assert.equal(t.taxCents, 11700);
  assert.equal(t.totalCents, 101700);
  assert.equal(t.depositRequiredCents, 50000);
});

test('percentages round half-up to the cent', () => {
  // 13% of $0.50 = 6.5¢ -> 7¢; 13% of $0.49 = 6.37¢ -> 6¢
  assert.equal(calculateQuoteTotals({ items: [{ quantity: 1, unitPriceCents: 50 }], discount: NONE, taxRateBp: 1300, deposit: NONE }).taxCents, 7);
  assert.equal(calculateQuoteTotals({ items: [{ quantity: 1, unitPriceCents: 49 }], discount: NONE, taxRateBp: 1300, deposit: NONE }).taxCents, 6);
  // 33.33% deposit of $100.01 = 3333.3333¢ -> 3333¢
  assert.equal(adjustmentCents(10001, { type: 'percent', value: 3333 }), 3333);
});

test('discounts and deposits never exceed their base', () => {
  assert.equal(adjustmentCents(5000, { type: 'fixed', value: 9000 }), 5000);
  assert.equal(adjustmentCents(5000, { type: 'percent', value: 10000 }), 5000);
  const t = calculateQuoteTotals({ items: [{ quantity: 1, unitPriceCents: 5000 }], discount: { type: 'fixed', value: 9000 }, taxRateBp: 1300, deposit: { type: 'fixed', value: 1 } });
  assert.equal(t.totalCents, 0);
  assert.equal(t.depositRequiredCents, 0);
});

test('an empty quote totals zero', () => {
  const t = calculateQuoteTotals({ items: [], discount: { type: 'percent', value: 500 }, taxRateBp: 1300, deposit: { type: 'percent', value: 5000 } });
  assert.equal(t.totalCents, 0);
  assert.equal(t.depositRequiredCents, 0);
});

test('same input, same result', () => {
  const input = { items: REFERENCE_ITEMS, discount: { type: 'percent', value: 750 }, taxRateBp: 1300, deposit: { type: 'percent', value: 5000 } } as const;
  assert.deepEqual(calculateQuoteTotals(input), calculateQuoteTotals(input));
});

test('item discounts come off their own line before the subtotal', () => {
  const t = calculateQuoteTotals({
    items: [
      { quantity: 1, unitPriceCents: 240000, discount: { type: 'percent', value: 1000 } }, // 10% off $2,400
      { quantity: 4, unitPriceCents: 15000, discount: { type: 'fixed', value: 5000 } }, // $50 off $600
      { quantity: 6, unitPriceCents: 6000 }, // no discount
    ],
    discount: { type: 'percent', value: 500 }, // then 5% off the subtotal
    taxRateBp: 1300,
    deposit: { type: 'percent', value: 5000 },
  });
  assert.deepEqual(t.lineTotalsCents, [240000, 60000, 36000]);
  assert.deepEqual(t.lineDiscountsCents, [24000, 5000, 0]);
  assert.deepEqual(t.lineNetCents, [216000, 55000, 36000]);
  assert.equal(t.itemDiscountsCents, 29000);
  assert.equal(t.subtotalCents, 307000);
  assert.equal(t.discountCents, 15350);
  assert.equal(t.taxableCents, 291650);
  assert.equal(t.taxCents, 37915); // 13% of $2,916.50 = $379.145 -> $379.15
  assert.equal(t.totalCents, 329565);
  assert.equal(t.depositRequiredCents, 164783); // half of $3,295.65, rounded up
});

test('an item discount never exceeds its line', () => {
  const t = calculateQuoteTotals({
    items: [{ quantity: 1, unitPriceCents: 1000, discount: { type: 'fixed', value: 5000 } }],
    discount: { type: 'none', value: 0 },
    taxRateBp: 1300,
    deposit: { type: 'none', value: 0 },
  });
  assert.deepEqual(t.lineNetCents, [0]);
  assert.equal(t.totalCents, 0);
});
