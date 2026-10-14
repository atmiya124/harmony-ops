import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankDraft, draftFromQuote, draftToValues, groupBySection, mapServerErrors, previewTotals, type QuoteDraft } from './quoteDraft';
import { QUOTE_DEFAULTS } from './defaults';

function filled(): QuoteDraft {
  const d = blankDraft(QUOTE_DEFAULTS, '2026-10-13');
  d.customerName = ' Michael Smith ';
  d.sections = [
    { key: 's1', name: 'LED Display', items: [{ key: 'i1', itemName: 'Outdoor LED Wall', description: '', quantity: '1', unitPrice: '2400', discountType: 'none', discountValue: '' }] },
    { key: 's2', name: 'Sound', items: [{ key: 'i2', itemName: 'Wireless Mics', description: 'Shure', quantity: '6', unitPrice: '60.00', discountType: 'none', discountValue: '' }] },
  ];
  return d;
}

test('a new draft uses the defaults: 13% HST, 30% deposit, valid 30 days', () => {
  const d = blankDraft(QUOTE_DEFAULTS, '2026-10-13');
  assert.equal(d.validUntil, '2026-11-12');
  assert.equal(d.taxRate, '13');
  assert.equal(d.depositType, 'percent');
  assert.equal(d.depositValue, '30');
});

test('draft to API values: trimmed, cents and basis points, sections flattened in order', () => {
  const { values, errors } = draftToValues(filled());
  assert.deepEqual(errors, {});
  assert.equal(values!.customerName, 'Michael Smith');
  assert.equal(values!.customerCompany, null);
  assert.equal(values!.taxRateBp, 1300);
  assert.equal(values!.depositValue, 3000);
  assert.deepEqual(
    values!.items.map((i) => [i.section, i.itemName, i.quantity, i.unitPriceCents, i.description]),
    [
      ['LED Display', 'Outdoor LED Wall', 1, 240000, null],
      ['Sound', 'Wireless Mics', 6, 6000, 'Shure'],
    ],
  );
});

test('live preview matches the calculator', () => {
  const t = previewTotals(filled());
  assert.equal(t.subtotalCents, 276000);
  assert.equal(t.taxCents, 35880);
  assert.equal(t.totalCents, 311880);
  assert.equal(t.depositRequiredCents, 93564); // 30% of the total
});

test('half-typed values count as zero in the preview but block saving', () => {
  const d = filled();
  d.sections[0].items[0].unitPrice = '24.0.0';
  d.sections[1].items[0].quantity = '';
  assert.equal(previewTotals(d).subtotalCents, 0);
  const { values, errors } = draftToValues(d);
  assert.equal(values, null);
  assert.ok(errors['item:i1:unitPrice']);
  assert.ok(errors['item:i2:quantity']);
});

test('required fields and cross-field rules', () => {
  const d = filled();
  d.customerName = '';
  d.validUntil = '2026-10-01';
  d.sections[0].name = ' ';
  d.discountType = 'fixed';
  d.discountValue = '99999';
  const { errors } = draftToValues(d);
  assert.ok(errors.customerName);
  assert.ok(errors.validUntil);
  assert.ok(errors['section:s1']);

  const e = filled();
  e.discountType = 'fixed';
  e.discountValue = '99999';
  assert.ok(draftToValues(e).errors.discountValue);
});

test('saved items are regrouped into consecutive sections, keeping ids', () => {
  const groups = groupBySection([
    { section: 'A', n: 1 },
    { section: 'A', n: 2 },
    { section: 'B', n: 3 },
    { section: 'A', n: 4 },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.section, g.items.map((i) => i.n)]),
    [
      ['A', [1, 2]],
      ['B', [3]],
      ['A', [4]],
    ],
  );
  const { values } = draftToValues(filled());
  const draft = draftFromQuote({
    ...values!,
    items: values!.items.map((i, n) => ({ ...i, id: `id-${n}` })),
  });
  assert.deepEqual(
    draft.sections.map((s) => [s.name, s.items.map((i) => [i.id, i.unitPrice])]),
    [
      ['LED Display', [['id-0', '2400.00']]],
      ['Sound', [['id-1', '60.00']]],
    ],
  );
  assert.equal(draftToValues(draft).values!.items[1].id, 'id-1');
});

test('server field errors land on the right inputs', () => {
  assert.deepEqual(mapServerErrors({ 'items.1.unitPriceCents': ['Too much'], taxRateBp: ['Bad rate'], customerName: ['Required'] }, ['i1', 'i2']), {
    'item:i2:unitPrice': 'Too much',
    taxRate: 'Bad rate',
    customerName: 'Required',
  });
});

test('item discounts: parsed per line, previewed, and checked', () => {
  const d = filled();
  d.sections[0].items[0].discountType = 'percent';
  d.sections[0].items[0].discountValue = '10'; // 10% off $2,400
  d.sections[1].items[0].discountType = 'fixed';
  d.sections[1].items[0].discountValue = '60'; // $60 off $360
  const t = previewTotals(d);
  assert.deepEqual(t.lineDiscountsCents, [24000, 6000]);
  assert.equal(t.subtotalCents, 246000);
  const { values } = draftToValues(d);
  assert.deepEqual(
    values!.items.map((i) => [i.discountType, i.discountValue]),
    [
      ['percent', 1000],
      ['fixed', 6000],
    ],
  );
  // Round-trips through a saved quote.
  const back = draftFromQuote({ ...values!, items: values!.items.map((i, n) => ({ ...i, id: `id-${n}` })) });
  assert.deepEqual(
    back.sections.map((s) => [s.items[0].discountType, s.items[0].discountValue]),
    [
      ['percent', '10'],
      ['fixed', '60.00'],
    ],
  );

  d.sections[1].items[0].discountValue = '400'; // more than the $360 line
  assert.equal(draftToValues(d).errors['item:i2:discountValue'], "Can't be more than the line total");
  d.sections[1].items[0].discountType = 'percent';
  d.sections[1].items[0].discountValue = 'abc';
  assert.ok(draftToValues(d).errors['item:i2:discountValue']);
});

test('cash: the preview and saved values carry no HST; the typed rate is kept for switching back', () => {
  const d = filled();
  d.paymentMethod = 'cash';
  d.taxRate = 'not a number'; // ignored for cash
  assert.equal(previewTotals(d).taxCents, 0);
  const { values, errors } = draftToValues(d);
  assert.deepEqual(errors, {});
  assert.equal(values!.paymentMethod, 'cash');
  assert.equal(values!.taxRateBp, 0);

  const back = { ...filled(), paymentMethod: 'etransfer' as const };
  assert.equal(previewTotals(back).taxCents, 35880);
});
