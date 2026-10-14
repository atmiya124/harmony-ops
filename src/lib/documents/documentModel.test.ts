import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentFileName, invoiceDocument, quoteDocument, signedAcceptance, splitTerms, termsPlacement } from './documentModel';
import type { DocumentAcceptance } from '../db/clientLinkRepo';
import { BLANK_CONFIG, invoiceFixture, quoteFixture, SAMPLE_CONFIG } from './testFixtures';

const totalsOf = (rows: { label: string; value: string }[]) => rows.map((r) => `${r.label} = ${r.value}`);

test('quote totals: stored figures, discount before HST (not the sample PDF tax-first maths)', () => {
  const doc = quoteDocument(quoteFixture(), SAMPLE_CONFIG);
  assert.deepEqual(totalsOf(doc.totals), ['Sub total = $16,240.00', 'Discount 5% = −$812.00', 'HST 13% = $2,005.64']);
  assert.equal(doc.grandTotal.value, '$17,433.64');
  assert.equal(doc.banner.value, '$17,433.64');
  assert.deepEqual(totalsOf(doc.afterGrandTotal), ['Deposit required (50%) = $8,716.82']);
});

test('the document never re-adds money: it prints exactly what was stored', () => {
  const q = quoteFixture();
  const doc = quoteDocument({ ...q, totalCents: 123, taxCents: 45 }, SAMPLE_CONFIG);
  assert.equal(doc.grandTotal.value, '$1.23');
  assert.equal(doc.totals.find((r) => r.label.startsWith('HST'))!.value, '$0.45');
});

test('discount and tax rows only appear when they apply', () => {
  const plain = quoteDocument(quoteFixture({ discountType: 'none', taxRateBp: 0, depositType: 'none' }), SAMPLE_CONFIG);
  assert.deepEqual(totalsOf(plain.totals), ['Sub total = $16,240.00']);
  assert.equal(plain.grandTotal.value, '$16,240.00');
  assert.deepEqual(plain.afterGrandTotal, []);

  const fixed = quoteDocument(quoteFixture({ discountType: 'fixed', discountValue: 50000 }), SAMPLE_CONFIG);
  assert.equal(fixed.totals[1].label, 'Discount'); // no percentage for a fixed amount
  assert.equal(fixed.totals[1].value, '−$500.00');
  assert.equal(fixed.totals[1].tone, 'discount');
});

test('items: grouped by section in order, with descriptions and line discounts', () => {
  const doc = quoteDocument(
    quoteFixture({
      items: [
        { section: 'LED Display', itemName: 'Indoor LED Wall P2.6', description: '16 ft x 9 ft modular LED screen', quantity: 1, unitPriceCents: 240000, discountType: 'percent', discountValue: 1000 },
        { section: 'LED Display', itemName: 'TV', quantity: 2, unitPriceCents: 15000 },
        { section: 'Sound', itemName: 'PA', quantity: 1, unitPriceCents: 50000 },
      ],
    }),
    SAMPLE_CONFIG,
  );
  assert.deepEqual(
    doc.sections.map((s) => [s.name, s.items.map((i) => i.name)]),
    [
      ['LED Display', ['Indoor LED Wall P2.6', 'TV']],
      ['Sound', ['PA']],
    ],
  );
  const wall = doc.sections[0].items[0];
  assert.equal(wall.description, '16 ft x 9 ft modular LED screen');
  assert.equal(wall.unitPrice, '$2,400.00');
  assert.equal(wall.total, '$2,160.00');
  assert.equal(wall.originalTotal, '$2,400.00');
  assert.equal(wall.discountNote, 'Discount 10% −$240.00');
  const tv = doc.sections[0].items[1];
  assert.equal(tv.description, null);
  assert.equal(tv.originalTotal, null);
  assert.equal(tv.discountNote, null);
  // Item discounts are shown above the subtotal they're already part of.
  assert.deepEqual(totalsOf(doc.totals).slice(0, 3), ['Items = $3,200.00', 'Item discounts = −$240.00', 'Sub total = $2,960.00']);
});

test('customer and meta: real values only, missing ones dropped', () => {
  const full = quoteDocument(quoteFixture(), SAMPLE_CONFIG);
  assert.deepEqual(full.customer.addressLines, ['220 West 53rd Street, New York, NY 10019, USA']);
  assert.deepEqual(
    full.meta.map((m) => `${m.label}: ${m.value}`),
    ['Quote N°: Q-000000218', 'Quote date: 13 Oct, 2026', 'Valid until: 12 Nov, 2026'],
  );
  // Event details live at the foot of the customer column, not with the quote details.
  assert.deepEqual(
    full.event.map((m) => `${m.label}: ${m.value}`),
    ['Event: Smith Corporate Gala', 'Event date: 17 Oct, 2026'],
  );
  const withVenue = quoteDocument(quoteFixture({ overrides: { venueName: 'Palais Royale', venueAddress: '1601 Lake Shore Blvd W' } }), SAMPLE_CONFIG);
  assert.deepEqual(withVenue.event.at(-1), { label: 'Venue', value: 'Palais Royale, 1601 Lake Shore Blvd W' });

  const bare = quoteDocument(
    quoteFixture({ overrides: { customerCompany: null, customerEmail: null, customerPhone: null, billingAddress: null, eventDate: null, eventName: null } }),
    SAMPLE_CONFIG,
  );
  assert.deepEqual(bare.customer, { heading: 'Quote prepared for:', name: 'Michael Smith', company: null, addressLines: [], email: null, phone: null });
  assert.deepEqual(bare.event, []); // no event details at all: the block is left out

  const undated = quoteDocument(quoteFixture({ overrides: { eventDate: null } }), SAMPLE_CONFIG);
  assert.deepEqual(undated.event, [
    { label: 'Event', value: 'Smith Corporate Gala' },
    { label: 'Event date', value: 'TBC' }, // as on the reference
  ]);

  const multiLine = quoteDocument(quoteFixture({ overrides: { billingAddress: 'Unit 4\n\n  100 Long Road  \nToronto, ON' } }), SAMPLE_CONFIG);
  assert.deepEqual(multiLine.customer.addressLines, ['Unit 4', '100 Long Road', 'Toronto, ON']);
});

test('terms: one per line, wording unchanged, blank lines dropped', () => {
  assert.deepEqual(splitTerms('First term.\r\n\n  Second term, as written.  \n'), ['First term.', 'Second term, as written.']);
  assert.deepEqual(splitTerms(null), []);
  assert.equal(quoteDocument(quoteFixture(), SAMPLE_CONFIG).terms.length, 5);
  assert.deepEqual(quoteDocument(quoteFixture({ overrides: { terms: null } }), SAMPLE_CONFIG).terms, []);
});

test('file names are sanitised', () => {
  assert.equal(documentFileName('Harmony Production', 'Quote', 'Q-000000001'), 'Harmony_Production_Quote_Q-000000001.pdf');
  assert.equal(documentFileName('Harmony Production', 'Invoice', 'INV-000000001'), 'Harmony_Production_Invoice_INV-000000001.pdf');
  assert.equal(documentFileName('Harmony "Pro" / Ltd.', 'Quote', '../Q-1\r\n'), 'Harmony_Pro_Ltd_Quote_Q-1.pdf');
  assert.equal(quoteDocument(quoteFixture(), SAMPLE_CONFIG).fileName, 'Harmony_Production_Quote_Q-000000218.pdf');
});

test('quote payment block uses the central config; no bank details are invented', () => {
  const doc = quoteDocument(quoteFixture(), SAMPLE_CONFIG);
  assert.equal(doc.payment!.title, 'Payment method: E-Transfer, VISA, MasterCard, Bank Transfer');
  assert.deepEqual(totalsOf(doc.payment!.rows), ['E-Transfer = payments@example.com', 'Card payment = We accept: Visa, MasterCard, American Express']);
  assert.deepEqual(doc.questions, { title: 'Questions about this quote?', text: 'Contact us at info@example.com or +1 (416) 555-0100. Please quote the reference number Q-000000218.' });
  assert.ok(doc.acceptance);
  assert.equal(doc.paymentStatus, null);
});

test('with company details unset nothing fake is printed', () => {
  const doc = quoteDocument(quoteFixture(), BLANK_CONFIG);
  const text = JSON.stringify(doc);
  assert.doesNotMatch(text, /example\.com|000-0000|Your Street|Bank Name|Acct 0/);
  assert.equal(doc.payment!.rows.some((r) => r.label === 'E-Transfer'), false); // no e-transfer address configured
  assert.equal(doc.questions.text, 'Contact Harmony Production. Please quote the reference number Q-000000218.');
});

test('invoice totals: invoice total, deposit paid, balance due — all stored values', () => {
  const doc = invoiceDocument(invoiceFixture(), SAMPLE_CONFIG);
  assert.deepEqual(totalsOf(doc.totals), [
    'Sub total = $16,240.00',
    'Discount 5% = −$812.00',
    'HST 13% = $2,005.64',
    'Invoice total = $17,433.64',
    'Deposit paid = −$8,716.82',
  ]);
  assert.deepEqual(doc.grandTotal, { label: 'Balance due', value: '$8,716.82' });
  assert.deepEqual(doc.banner, { label: 'Balance due', value: '$8,716.82' });
  assert.deepEqual(
    doc.meta.map((m) => `${m.label}: ${m.value}`),
    ['Invoice N°: INV-000000218', 'Invoice date: 13 Oct, 2026', 'Due date: 27 Oct, 2026', 'Quote ref: Q-000000218'],
  );
  assert.deepEqual(
    doc.event.map((m) => `${m.label}: ${m.value}`),
    ['Event: Smith Corporate Gala', 'Event date: 17 Oct, 2026'],
  );
  assert.equal(doc.fileName, 'Harmony_Production_Invoice_INV-000000218.pdf');
  assert.equal(doc.payment!.reference, 'Reference: INV-000000218');
  assert.equal(doc.acceptance, null);
});

test('invoice rows only appear when they apply', () => {
  const unpaid = invoiceDocument(invoiceFixture(quoteFixture(), { depositPaidCents: 0 }), SAMPLE_CONFIG);
  assert.equal(unpaid.totals.some((r) => r.label === 'Deposit paid'), false);
  assert.equal(unpaid.totals.some((r) => r.label === 'Amount paid'), false);
  assert.equal(unpaid.grandTotal.value, '$17,433.64');

  const partial = invoiceDocument(invoiceFixture(quoteFixture(), { amountPaidCents: 100000 }), SAMPLE_CONFIG);
  assert.equal(partial.totals.find((r) => r.label === 'Amount paid')!.value, '−$1,000.00');
  assert.equal(partial.grandTotal.value, '$7,716.82');
});

test('invoice payment rows: bank transfer only when every bank field is set', () => {
  assert.deepEqual(
    invoiceDocument(invoiceFixture(), SAMPLE_CONFIG).payment!.rows.map((r) => r.label),
    ['E-Transfer', 'Card'],
  );
  const withBank = invoiceDocument(invoiceFixture(), {
    ...SAMPLE_CONFIG,
    payment: { ...SAMPLE_CONFIG.payment, bank: { bankName: 'Test Bank', transit: '12345', institution: '001', account: '7654321' } },
  });
  assert.equal(withBank.payment!.rows[1].value, 'Test Bank · Transit 12345 · Inst. 001 · Acct 7654321');
  const half = invoiceDocument(invoiceFixture(), {
    ...SAMPLE_CONFIG,
    payment: { ...SAMPLE_CONFIG.payment, bank: { bankName: 'Test Bank', transit: '', institution: '001', account: '7654321' } },
  });
  assert.equal(half.payment!.rows.some((r) => r.label === 'Bank transfer'), false);
});

test('payment status reflects only what the invoice records', () => {
  const s = invoiceDocument(invoiceFixture(), SAMPLE_CONFIG).paymentStatus!;
  assert.deepEqual(
    s.steps.map((x) => [x.label, x.detail, x.value, x.state]),
    [
      ['Quote accepted', '13 Oct, 2026', 'Q-000000218', 'done'],
      ['Deposit received', null, '$8,716.82', 'done'],
      ['Balance due', '27 Oct, 2026', '$8,716.82', 'current'],
    ],
  );
  assert.equal(s.badge, 'Unpaid balance');
  assert.equal(s.caption, 'Accepted from quote Q-000000218 on 13 Oct, 2026');

  const q = quoteFixture();
  const paid = invoiceDocument(invoiceFixture(q, { depositPaidCents: q.depositRequiredCents, amountPaidCents: q.totalCents - q.depositRequiredCents }, { status: 'paid', paidAt: '2026-10-20T12:00:00Z' }), SAMPLE_CONFIG).paymentStatus!;
  assert.equal(paid.badge, 'Paid');
  assert.equal(paid.badgeTone, 'paid');
  assert.deepEqual(paid.steps.at(-1), { label: 'Paid in full', detail: '20 Oct, 2026', value: '$17,433.64', state: 'done' });

  const standalone = invoiceDocument(invoiceFixture(quoteFixture(), { depositPaidCents: 0 }, { quoteId: null, quoteNumber: null, quoteAcceptedAt: null }), SAMPLE_CONFIG).paymentStatus!;
  assert.deepEqual(standalone.steps.map((x) => x.label), ['Balance due']);
  assert.equal(standalone.caption, null);
});

test('payment details can be left off a quote or invoice; totals stay', () => {
  const quote = quoteDocument(quoteFixture({ overrides: { showPaymentDetails: false } }), SAMPLE_CONFIG);
  assert.equal(quote.payment, null);
  assert.equal(quote.termsPlacement, 'summary'); // the five reference terms move beside the totals
  assert.equal(quote.grandTotal.value, '$17,433.64');
  assert.ok(quote.acceptance);

  const invoice = invoiceDocument(invoiceFixture(quoteFixture(), {}, { showPaymentDetails: false }), SAMPLE_CONFIG);
  assert.equal(invoice.payment, null);
  assert.equal(invoice.grandTotal.value, '$8,716.82');
  assert.ok(invoice.paymentStatus); // the status timeline isn't payment instructions
});

test('terms go beside the totals only when payment details are off and they fit', () => {
  const five = splitTerms(quoteFixture().terms);
  assert.equal(termsPlacement(true, five), 'section'); // payment section is there
  assert.equal(termsPlacement(false, five), 'summary');
  assert.equal(termsPlacement(false, []), 'section'); // nothing to move
  const long = Array.from({ length: 12 }, (_, n) => `Term ${n + 1}: ${'a long clause '.repeat(8)}`);
  assert.equal(termsPlacement(false, long), 'section'); // too long for the space; keeps its own section

  const shown = quoteDocument(quoteFixture(), SAMPLE_CONFIG);
  assert.equal(shown.termsPlacement, 'section');
  const longDoc = quoteDocument(quoteFixture({ overrides: { showPaymentDetails: false, terms: long.join('\n') } }), SAMPLE_CONFIG);
  assert.equal(longDoc.termsPlacement, 'section');
  assert.equal(longDoc.terms.length, 12);
});

// A client acceptance as stored by the client link (Phase 3).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function accepted(quote: ReturnType<typeof quoteFixture>, over: Partial<DocumentAcceptance> = {}): DocumentAcceptance {
  return { customerName: 'Michael Smith', customerTitle: 'Event Director', signatureType: 'typed', signatureData: 'Michael Smith', quoteTotalCents: quote.totalCents, acceptedAt: '2026-10-13T19:05:00.000Z', ...over };
}

test('an online acceptance fills in the customer signature block', () => {
  const quote = quoteFixture({ overrides: { status: 'accepted' } });
  const typed = quoteDocument(quote, SAMPLE_CONFIG, accepted(quote)).acceptance!.signed;
  assert.deepEqual(typed, { name: 'Michael Smith', title: 'Event Director', date: '13 Oct, 2026', acceptedAt: '13 Oct, 2026, 3:05 p.m.', signature: { kind: 'typed', text: 'Michael Smith' } });

  const drawn = signedAcceptance(quote, accepted(quote, { signatureType: 'drawn', signatureData: PNG, customerTitle: null }));
  assert.deepEqual(drawn?.signature, { kind: 'drawn', image: PNG });
  assert.equal(drawn?.title, null);

  // Missing or unreadable signature data: the rest still prints.
  assert.equal(signedAcceptance(quote, accepted(quote, { signatureData: null }))?.signature, null);
  assert.equal(signedAcceptance(quote, accepted(quote, { signatureType: 'drawn', signatureData: 'https://evil.example/x.png' }))?.signature, null);
});

test('no acceptance, or one that no longer matches the quote, leaves the lines blank', () => {
  const quote = quoteFixture({ overrides: { status: 'accepted' } });
  assert.equal(quoteDocument(quote, SAMPLE_CONFIG).acceptance!.signed, null);
  assert.equal(signedAcceptance(quoteFixture({ overrides: { status: 'draft' } }), accepted(quote)), null);
  assert.equal(signedAcceptance(quote, accepted(quote, { quoteTotalCents: quote.totalCents + 100 })), null);
  assert.ok(signedAcceptance(quoteFixture({ overrides: { status: 'converted' } }), accepted(quote)));
});

test('payment method: cash prints "No HST (cash payment)" and only cash; a chosen method lists just that one', () => {
  const cash = quoteDocument(quoteFixture({ taxRateBp: 0, overrides: { paymentMethod: 'cash' } }), SAMPLE_CONFIG);
  assert.ok(totalsOf(cash.totals).includes('No HST (cash payment) = $0.00'));
  assert.equal(cash.payment!.title, 'Payment method: Cash');
  assert.deepEqual(totalsOf(cash.payment!.rows), ['Cash = Paid in cash — no HST is charged']);

  const card = quoteDocument(quoteFixture({ overrides: { paymentMethod: 'card' } }), SAMPLE_CONFIG);
  assert.equal(card.payment!.title, 'Payment method: Credit card');
  assert.deepEqual(totalsOf(card.payment!.rows), ['Card payment = We accept: Visa, MasterCard, American Express']);
  assert.ok(totalsOf(card.totals).some((r) => r.startsWith('HST 13%')));

  // Not chosen: every method, as before.
  assert.equal(quoteDocument(quoteFixture(), SAMPLE_CONFIG).payment!.title, 'Payment method: E-Transfer, VISA, MasterCard, Bank Transfer');
});
