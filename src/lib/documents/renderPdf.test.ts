// Renders real PDFs with headless Chrome and checks the page layout. Skipped
// when no Chrome/Chromium is installed (set CHROME_EXECUTABLE_PATH to use one).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDocumentHtml } from '@/components/documents/renderDocument';
import { invoiceDocument, quoteDocument, type DocumentModel } from './documentModel';
import { closePdfBrowser, localChromePath, renderPdf } from './renderPdf';
import { invoiceFixture, quoteFixture, REFERENCE_ITEMS, SAMPLE_CONFIG, type FixtureItem } from './testFixtures';
import type { DocumentLayout } from './layoutScript';

const skip = localChromePath() ? false : 'no Chrome/Chromium installed';

after(() => closePdfBrowser());

const LONG = 'Includes delivery, rigging, power distribution, signal cabling, a dedicated on-site technician for the full event, and teardown after the last guest leaves the venue. ';

function items(count: number, sections = ['LED Display', 'Sound', 'Stage', 'Lighting', 'Services'], longEvery = 3): FixtureItem[] {
  return Array.from({ length: count }, (_, n) => ({
    section: sections[Math.floor((n * sections.length) / count)],
    itemName: `Item ${n + 1}`,
    description: n % longEvery === 0 ? LONG.repeat(1 + (n % 2)) : n % 2 ? null : 'Short note.',
    quantity: 1 + (n % 4),
    unitPriceCents: 10_000 + n * 2_500,
  }));
}

// Invariants every rendered document must satisfy.
function checkLayout(layout: DocumentLayout, pdf: Uint8Array, itemCount: number) {
  assert.equal(layout.pages.length, layout.pageCount);
  assert.equal(
    layout.pages.reduce((n, p) => n + p.items, 0),
    itemCount,
    'every item placed exactly once',
  );
  layout.pages.forEach((p, i) => {
    assert.equal(p.pageLabel, `PAGE ${i + 1} OF ${layout.pageCount}`);
    assert.equal(p.overflow, false, `page ${i + 1}: nothing clipped`);
    const last = p.kinds.at(-1);
    if (i < layout.pageCount - 1) assert.ok(last !== 'section' && last !== 'band-head', `page ${i + 1} ends with a stranded ${last}`);
    // A page that opens mid-section repeats that section's header.
    if (i > 0 && p.kinds[0] === 'item') assert.equal(p.continued.length, 1, `page ${i + 1} continues a section`);
    const head = p.kinds.lastIndexOf('band-head');
    if (head !== -1 && p.kinds[head + 1] === 'term' && i < layout.pageCount - 1) {
      assert.ok(p.kinds[head + 2] === 'term', `page ${i + 1}: terms heading left with a single term`);
    }
  });
  const text = Buffer.from(pdf).toString('latin1');
  assert.ok(text.startsWith('%PDF-'));
  assert.equal(text.match(/\/Type\s*\/Page(?!s)/g)?.length, layout.pageCount, 'PDF page count matches the layout');
}

async function render(doc: DocumentModel) {
  return renderPdf(renderDocumentHtml(doc));
}

test('reference quote: 19 items over three pages, terms kept together', { skip }, async () => {
  const { pdf, layout } = await render(quoteDocument(quoteFixture(), SAMPLE_CONFIG));
  checkLayout(layout, pdf, REFERENCE_ITEMS.length);
  assert.equal(layout.pageCount, 3);
  // The totals block follows the items; the terms heading never leaves a
  // single term behind — all five go on the last page with the acceptance.
  assert.ok(layout.pages[1].kinds.includes('block'));
  const lastKinds = layout.pages[2].kinds;
  assert.equal(lastKinds.filter((k) => k === 'term').length, 5);
  assert.ok(lastKinds.includes('block'));
});

test('reference invoice: three pages, with the payment status block', { skip }, async () => {
  const { pdf, layout } = await render(invoiceDocument(invoiceFixture(), SAMPLE_CONFIG));
  checkLayout(layout, pdf, REFERENCE_ITEMS.length);
  assert.equal(layout.pageCount, 3);
});

for (const count of [1, 5, 15, 35]) {
  test(`quote with ${count} item${count === 1 ? '' : 's'} paginates cleanly`, { skip }, async () => {
    const { pdf, layout } = await render(quoteDocument(quoteFixture({ items: items(count) }), SAMPLE_CONFIG));
    checkLayout(layout, pdf, count);
    if (count === 35) {
      assert.ok(layout.pageCount >= 3, `35 items need several pages (got ${layout.pageCount})`);
      assert.ok(layout.pages.some((p) => p.continued.length > 0), 'a section runs over a page break as "(continued)"');
    }
  });
}

test('one very long section runs across pages, repeating its header each time', { skip }, async () => {
  const { pdf, layout } = await render(quoteDocument(quoteFixture({ items: items(40, ['Stage'], 2) }), SAMPLE_CONFIG));
  checkLayout(layout, pdf, 40);
  const continued = layout.pages.flatMap((p) => p.continued);
  assert.ok(continued.length >= 2);
  assert.ok(continued.every((s) => s === 'Stage'));
});

test('long customer address, long terms and no discount / no HST', { skip }, async () => {
  const terms = Array.from({ length: 30 }, (_, n) => `Term ${n + 1}: ${LONG}`).join('\n');
  const quote = quoteFixture({
    items: items(8),
    discountType: 'none',
    taxRateBp: 0,
    depositType: 'none',
    overrides: { billingAddress: ['Attn: Accounts Payable', 'Suite 2400', '1 Very Long Corporate Avenue West', 'Mississauga, Ontario', 'L5B 0A0', 'Canada'].join('\n'), terms, notes: LONG },
  });
  const { pdf, layout } = await render(quoteDocument(quote, SAMPLE_CONFIG));
  checkLayout(layout, pdf, 8);
  assert.equal(
    layout.pages.reduce((n, p) => n + p.kinds.filter((k) => k === 'term').length, 0),
    30,
    'every term printed once',
  );
  assert.ok(layout.pageCount >= 3);
});

test('missing descriptions and optional customer fields', { skip }, async () => {
  const quote = quoteFixture({
    items: REFERENCE_ITEMS.map((i) => ({ ...i, description: null })),
    overrides: { customerCompany: null, customerEmail: null, customerPhone: null, billingAddress: null, eventDate: null, eventName: null, terms: null },
  });
  const { pdf, layout } = await render(quoteDocument(quote, SAMPLE_CONFIG));
  checkLayout(layout, pdf, REFERENCE_ITEMS.length);
  assert.equal(layout.pages.flatMap((p) => p.kinds).includes('term'), false);
});

test('quote and invoice without payment details still lay out cleanly', { skip }, async () => {
  for (const doc of [
    quoteDocument(quoteFixture({ overrides: { showPaymentDetails: false } }), SAMPLE_CONFIG),
    invoiceDocument(invoiceFixture(quoteFixture(), {}, { showPaymentDetails: false }), SAMPLE_CONFIG),
  ]) {
    const { pdf, layout } = await render(doc);
    checkLayout(layout, pdf, REFERENCE_ITEMS.length);
    assert.ok(layout.pageCount <= 3);
  }
});

test('long terms with payment details off keep their own section and paginate', { skip }, async () => {
  const terms = Array.from({ length: 20 }, (_, n) => `Term ${n + 1}: ${LONG}`).join('\n');
  const doc = quoteDocument(quoteFixture({ items: items(6), overrides: { showPaymentDetails: false, terms } }), SAMPLE_CONFIG);
  assert.equal(doc.termsPlacement, 'section');
  const { pdf, layout } = await render(doc);
  checkLayout(layout, pdf, 6);
  assert.equal(
    layout.pages.reduce((n, p) => n + p.kinds.filter((k) => k === 'term').length, 0),
    20,
  );
});
