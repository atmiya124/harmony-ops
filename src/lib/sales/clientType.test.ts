import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankDraft, changeClientType, draftFromQuote, draftToValues, hasDefaultTerms, termsAreDefault, withDefaultTerms, type QuoteDraft } from './quoteDraft';
import { QUOTE_DEFAULTS, QUOTE_TERMS } from './defaults';
import { toPublicQuote } from './publicQuote';
import { quoteCreateSchema } from '../schemas/quote';
import { quoteDocument } from '../documents/documentModel';
import { renderDocumentHtml } from '../../components/documents/renderDocument';
import { quoteFixture, SAMPLE_CONFIG } from '../documents/testFixtures';

function draft(): QuoteDraft {
  const d = blankDraft(QUOTE_DEFAULTS, '2026-10-19');
  d.customerName = 'Client';
  d.sections = [{ key: 's', name: 'Sound', items: [{ key: 'i', itemName: 'PA', description: '', quantity: '1', unitPrice: '100', discountType: 'none', discountValue: '' }] }];
  return d;
}

test('the two default templates differ and are both set', () => {
  assert.ok(QUOTE_TERMS.regular.trim());
  assert.ok(QUOTE_TERMS.contract.trim());
  assert.notEqual(QUOTE_TERMS.regular, QUOTE_TERMS.contract);
});

test('a new quote is a regular client with the regular terms', () => {
  const d = blankDraft(QUOTE_DEFAULTS, '2026-10-19');
  assert.equal(d.clientType, 'regular');
  assert.equal(d.terms, QUOTE_TERMS.regular);
  assert.equal(hasDefaultTerms(d), true);
});

test('regular -> contract -> regular swaps untouched terms without asking', () => {
  const toContract = changeClientType(draft(), 'contract');
  assert.equal(toContract.askToReplaceTerms, false);
  assert.equal(toContract.draft.clientType, 'contract');
  assert.equal(toContract.draft.terms, QUOTE_TERMS.contract);

  const back = changeClientType(toContract.draft, 'regular');
  assert.equal(back.askToReplaceTerms, false);
  assert.equal(back.draft.terms, QUOTE_TERMS.regular);
});

test('whitespace and blank lines alone do not count as an edit; empty terms take the defaults', () => {
  const d = { ...draft(), terms: `\n  ${QUOTE_TERMS.regular.split('\n').join('\n\n  ')}  \n` };
  assert.equal(termsAreDefault(d.terms), true);
  assert.equal(changeClientType(d, 'contract').draft.terms, QUOTE_TERMS.contract);
  assert.equal(changeClientType({ ...draft(), terms: '   ' }, 'contract').draft.terms, QUOTE_TERMS.contract);
});

test('edited terms are kept on a switch, and the builder is told to ask', () => {
  const edited = { ...draft(), terms: QUOTE_TERMS.regular + '\nParking: Client provides parking for the crew.' };
  const change = changeClientType(edited, 'contract');
  assert.equal(change.draft.clientType, 'contract');
  assert.equal(change.draft.terms, edited.terms, 'edits must never be replaced by the switch itself');
  assert.equal(change.askToReplaceTerms, true);
  assert.equal(hasDefaultTerms(change.draft), false);

  // Confirmed: now replaced with the contract defaults.
  assert.equal(withDefaultTerms(change.draft).terms, QUOTE_TERMS.contract);
});

test('choosing the same type changes nothing', () => {
  const d = { ...draft(), terms: 'Custom' };
  const change = changeClientType(d, 'regular');
  assert.equal(change.draft, d);
  assert.equal(change.askToReplaceTerms, false);
});

test('an existing quote keeps its saved terms even when the defaults differ', () => {
  const saved = quoteFixture({ overrides: { clientType: 'contract', terms: 'Old contract wording\nNet 15' } });
  const d = draftFromQuote(saved);
  assert.equal(d.clientType, 'contract');
  assert.equal(d.terms, 'Old contract wording\nNet 15');
  // Old wording is not a current default, so switching asks rather than replacing.
  assert.equal(changeClientType(d, 'regular').askToReplaceTerms, true);
  assert.equal(changeClientType(d, 'regular').draft.terms, 'Old contract wording\nNet 15');
});

test('the client type and exact terms are what gets saved', () => {
  const d = changeClientType(draft(), 'contract').draft;
  d.terms = 'Payment: Net 30\nEdited line';
  const { values } = draftToValues(d);
  assert.equal(values!.clientType, 'contract');
  assert.equal(values!.terms, 'Payment: Net 30\nEdited line');
});

test('server: client type defaults to regular and only the two types are accepted', () => {
  const base = {
    id: '5f0c7c1e-2d3b-4a8e-9f10-1234567890ab',
    customerName: 'Client',
    eventId: null,
    eventDate: null,
    quoteDate: '2026-10-19',
    validUntil: '2026-11-18',
    items: [{ section: 'Sound', itemName: 'PA', quantity: 1, unitPriceCents: 10000 }],
    discountType: 'none',
    discountValue: 0,
    taxLabel: 'HST',
    taxRateBp: 1300,
    depositType: 'none',
    depositValue: 0,
  };
  const omitted = quoteCreateSchema.safeParse(base);
  assert.equal(omitted.success && omitted.data.clientType, 'regular');
  const contract = quoteCreateSchema.safeParse({ ...base, clientType: 'contract' });
  assert.equal(contract.success && contract.data.clientType, 'contract');
  assert.equal(quoteCreateSchema.safeParse({ ...base, clientType: 'vip' }).success, false);
});

test('the client type never reaches the client page or the PDF', () => {
  const q = quoteFixture({ overrides: { clientType: 'contract' } });
  const pub = toPublicQuote(q, null, '2026-10-19');
  assert.equal('clientType' in pub, false);
  assert.doesNotMatch(JSON.stringify(pub), /contract client|"contract"/i);

  const html = renderDocumentHtml(quoteDocument(q, SAMPLE_CONFIG));
  assert.doesNotMatch(html, /contract client|regular client|client type/i);
  // Same document as a regular quote: the type changes nothing printed.
  assert.equal(html, renderDocumentHtml(quoteDocument({ ...q, clientType: 'regular' }, SAMPLE_CONFIG)));
});
