import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDocumentHtml } from './renderDocument';
import { escapeHtml, Fragment, Html, jsx } from '@/lib/documents/html/jsx-runtime';
import { invoiceDocument, quoteDocument } from '@/lib/documents/documentModel';
import { BLANK_CONFIG, invoiceFixture, quoteFixture, SAMPLE_CONFIG } from '@/lib/documents/testFixtures';

test('html runtime: escapes text and attributes, maps JSX names, skips empty values', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  const el = jsx('div', { className: 'a"b', title: '<x>', hidden: true, 'data-n': 3, skip: null, off: false, children: ['<b>', 1, null, false, new Html('<i>ok</i>')] });
  assert.equal(String(el), '<div class="a&quot;b" title="&lt;x&gt;" hidden data-n="3">&lt;b&gt;1<i>ok</i></div>');
  assert.equal(String(jsx('path', { strokeWidth: 1.3, fillRule: 'evenodd' })), '<path stroke-width="1.3" fill-rule="evenodd"></path>');
  assert.equal(String(jsx('p', { style: { marginTop: 10, minWidth: 0, color: 'red' } })), '<p style="margin-top:10px;min-width:0;color:red"></p>');
  const Comp = ({ name }: { name: string }) => jsx('b', { children: name });
  assert.equal(String(jsx(Fragment, { children: [jsx(Comp, { name: 'x' }), 'y'] })), '<b>x</b>y');
  assert.throws(() => jsx('img onerror=x', {}));
  assert.throws(() => jsx('div', { 'onclick="x"': 1 }));
});

test('customer-entered text can never become markup in the PDF', () => {
  const evil = '<script>alert(1)</script><img src=x onerror=alert(1)>';
  const html = renderDocumentHtml(
    quoteDocument(
      quoteFixture({
        items: [{ section: evil, itemName: evil, description: evil, quantity: 1, unitPriceCents: 100 }],
        overrides: { customerName: evil, billingAddress: evil, notes: evil, terms: evil, eventName: evil },
      }),
      SAMPLE_CONFIG,
    ),
  );
  assert.doesNotMatch(html, /<script>alert|<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  // The only script is the layout script.
  assert.equal(html.match(/<script>/g)?.length, 1);
});

test('the HTML is self-contained: no external URLs', () => {
  const html = renderDocumentHtml(quoteDocument(quoteFixture(), SAMPLE_CONFIG));
  assert.doesNotMatch(html, /(?:src|href)=["']?https?:/i);
  assert.doesNotMatch(html, /url\((?!data:|#)/); // inline data, or an in-document SVG gradient
  assert.match(html, /@font-face\{font-family:'Poppins'/);
});

test('quote HTML carries the reference structure', () => {
  const html = renderDocumentHtml(quoteDocument(quoteFixture(), SAMPLE_CONFIG));
  for (const text of [
    '>Quote</h1>',
    'EVENT PRODUCTION ESTIMATE',
    'Quote prepared for:',
    'Quote details:',
    'Total estimate :',
    'Item description',
    'data-flow="section" data-section="LED Display"',
    'Payment method: E-Transfer, VISA, MasterCard, Bank Transfer',
    'Terms &amp; conditions',
    'Quote acceptance',
    'Customer approval:',
    'I accept this quote, its pricing and the terms above.',
    '<img class="logo" src="data:image/png;base64,', // the embedded Harmony logo
    'alt="Harmony Production"',
    'LED DISPLAY  |  SOUND  |  STAGE  |  LIGHTS', // footer
    '$17,433.64',
    '$2,005.64',
    '−$812.00',
  ]) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(!html.includes('Payment status'));
});

test('invoice HTML carries the reference structure', () => {
  const html = renderDocumentHtml(invoiceDocument(invoiceFixture(), SAMPLE_CONFIG));
  for (const text of ['>Invoice</h1>', 'EVENT PRODUCTION SERVICES', 'Bill to:', 'Invoice details:', 'Balance due :', 'How to pay', 'Reference: INV-000000218', 'Payment status', 'Unpaid balance', 'Invoice total']) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(!html.includes('Quote acceptance'));
});

// The printed markup only (not the stylesheet or layout script).
const markup = (html: string) => html.replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>/g, '');

test('without payment details the terms take its place beside the totals', () => {
  const html = markup(renderDocumentHtml(quoteDocument(quoteFixture({ overrides: { showPaymentDetails: false } }), SAMPLE_CONFIG)));
  assert.ok(!html.includes('Payment method:'));
  assert.ok(!html.includes('pay-bar'));
  assert.ok(html.includes('class="pay pay-none with-terms"'));
  assert.ok(html.includes('<div class="pay-terms"><p class="q-title">Terms &amp; conditions</p>'));
  assert.ok(!html.includes('data-flow="term"')); // no separate terms section
  assert.ok(!html.includes('Please read before signing'));
  assert.ok(html.includes('$17,433.64'));
});

test('with no terms and no payment details, questions sit beside the totals', () => {
  const html = markup(renderDocumentHtml(quoteDocument(quoteFixture({ overrides: { showPaymentDetails: false, terms: null } }), SAMPLE_CONFIG)));
  assert.ok(html.includes('class="pay pay-none"'));
  assert.ok(html.includes('Questions about this quote?'));
});

test('terms are not numbered', () => {
  const html = markup(renderDocumentHtml(quoteDocument(quoteFixture(), SAMPLE_CONFIG)));
  assert.ok(html.includes('<p class="term" data-flow="term">A 50% non-refundable deposit'));
  assert.doesNotMatch(html, />0[1-5]</);
});

test('event details print at the foot of the customer column', () => {
  const html = markup(renderDocumentHtml(quoteDocument(quoteFixture(), SAMPLE_CONFIG)));
  const customer = html.slice(html.indexOf('class="party customer-block"'), html.indexOf('Quote details:'));
  assert.ok(customer.includes('<div class="event-title">Event details</div>'));
  assert.ok(customer.includes('Smith Corporate Gala'));
  const none = markup(renderDocumentHtml(quoteDocument(quoteFixture({ overrides: { eventName: null, eventDate: null } }), SAMPLE_CONFIG)));
  assert.ok(!none.includes('event-block'));
});

test('unset company details leave no empty labels or placeholder text', () => {
  const html = markup(renderDocumentHtml(quoteDocument(quoteFixture(), BLANK_CONFIG)));
  assert.doesNotMatch(html, /null|undefined|example\.com|<p><\/p>/);
});

test('a quote accepted online prints the client signature, name, title and time', () => {
  const quote = quoteFixture({ overrides: { status: 'accepted' } });
  const base = { customerName: 'Michael <b>Smith</b>', customerTitle: 'Event Director', quoteTotalCents: quote.totalCents, acceptedAt: '2026-10-13T19:05:00.000Z' };
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  const drawn = markup(renderDocumentHtml(quoteDocument(quote, SAMPLE_CONFIG, { ...base, signatureType: 'drawn', signatureData: png })));
  for (const text of ['Accepted online · 13 Oct, 2026, 3:05 p.m.', `<img class="sig-image" src="${png}"`, 'Michael &lt;b&gt;Smith&lt;/b&gt;', 'Event Director', 'box checked']) {
    assert.ok(drawn.includes(text), text);
  }
  assert.ok(!drawn.includes('Sign and return'));

  const typed = markup(renderDocumentHtml(quoteDocument(quote, SAMPLE_CONFIG, { ...base, customerTitle: null, signatureType: 'typed', signatureData: 'Michael Smith' })));
  assert.ok(typed.includes('<span class="sig-typed">Michael Smith</span>'));
  assert.ok(typed.includes('(typed)'));
  assert.ok(!typed.includes('Event Director'));

  const missing = markup(renderDocumentHtml(quoteDocument(quote, SAMPLE_CONFIG, { ...base, signatureType: 'drawn', signatureData: null })));
  assert.ok(missing.includes('Signature on file unavailable'));

  // Not accepted online: the blank sign-and-return lines.
  assert.ok(markup(renderDocumentHtml(quoteDocument(quote, SAMPLE_CONFIG))).includes('Sign and return'));
});

test('an accepted quote is signed for the company by its creator, dated the day it was sent', () => {
  const quote = quoteFixture({ overrides: { status: 'accepted', sentAt: '2026-10-14T23:30:00.000Z' } });
  const acceptance = { customerName: 'Michael Smith', customerTitle: null, quoteTotalCents: quote.totalCents, acceptedAt: '2026-10-16T19:05:00.000Z', signatureType: 'typed' as const, signatureData: 'Michael Smith' };
  const html = markup(renderDocumentHtml(quoteDocument(quote, SAMPLE_CONFIG, acceptance)));
  const company = html.slice(html.indexOf('Authorized by'), html.indexOf('Customer approval:'));
  assert.ok(company.includes('<span class="sig-typed">Atmiya Patel</span>'));
  assert.ok(company.includes('<span class="filled">Atmiya Patel</span>'));
  assert.ok(company.includes('14 Oct, 2026'), 'sent date, in Toronto time');

  // Never sent: dated with the quote date.
  const unsent = markup(renderDocumentHtml(quoteDocument({ ...quote, sentAt: null }, SAMPLE_CONFIG, acceptance)));
  assert.ok(unsent.slice(unsent.indexOf('Authorized by'), unsent.indexOf('Customer approval:')).includes('13 Oct, 2026'));

  // Not accepted: the company lines stay blank too.
  const blank = markup(renderDocumentHtml(quoteDocument(quote, SAMPLE_CONFIG)));
  assert.ok(!blank.includes('Atmiya Patel'));
});

test('a paid invoice carries the PAID stamp in place of the badge; an unpaid one doesn’t', () => {
  const q = quoteFixture();
  const paid = renderDocumentHtml(invoiceDocument(invoiceFixture(q, { amountPaidCents: q.totalCents - q.depositRequiredCents }, { status: 'paid' }), SAMPLE_CONFIG));
  assert.match(paid, /<img class="paid-stamp" src="data:image\/svg\+xml;base64,[^"]+"[^>]*alt="Paid"/);
  assert.doesNotMatch(paid, /class="badge paid"/);
  const unpaid = renderDocumentHtml(invoiceDocument(invoiceFixture(), SAMPLE_CONFIG));
  assert.doesNotMatch(unpaid, /<img class="paid-stamp"/);
  assert.match(unpaid, /class="badge due"/);
});
