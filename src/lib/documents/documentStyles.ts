// Print CSS for the quote / invoice PDFs. A4 pages (the reference documents
// are A4), white paper, charcoal text, light-grey bands and Harmony orange.
// Fonts are embedded (fonts.generated.ts — regenerate from
// node_modules/@fontsource/poppins/files/poppins-latin-{400,500,600,700}-normal.woff2
// as base64), so rendering never depends on the network.

import { POPPINS_WOFF2 } from './fonts.generated';

const fontFaces = (Object.entries(POPPINS_WOFF2) as [string, string][])
  .map(([weight, data]) => `@font-face{font-family:'Poppins';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');}`)
  .join('\n');

export const DOCUMENT_CSS = `
${fontFaces}
:root {
  --ink: #23232a;
  --ink-2: #5f5f68;
  --ink-3: #9a9aa2;
  --line: #e4e3e0;
  --band: #f3f3f4;
  --accent: #f08a1d;
  --accent-ink: #d9700c;
  --discount: #e0532a;
  --paid: #2f9d63;
  --dark: #25252b;
  /* The faint diagonal pin-stripe of the reference header and footer bands,
     drawn straight on the white page (no fill behind it). */
  --stripes: repeating-linear-gradient(-45deg, rgba(60, 55, 80, 0.07) 0 1px, transparent 1px 7px);
}
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  font-family: 'Poppins', Arial, sans-serif;
  color: var(--ink);
  font-size: 10px;
  line-height: 1.4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
p { margin: 0; }

/* ---------- pages ---------- */
.page {
  width: 210mm;
  height: 297mm;
  padding: 0 13mm;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  break-after: page;
  background: #fff;
}
.page:last-child { break-after: auto; }
.page-body { flex: 1 1 auto; min-height: 0; overflow: hidden; }
/* Off-screen source the layout script measures and copies from; same width as a page body. */
#flow { position: absolute; left: -10000px; top: 0; width: calc(210mm - 26mm); }
#flow .page-head, #flow .cont-head { width: calc(210mm - 26mm); }

/* ---------- header (page 1) ---------- */
/* Full-bleed striped band behind the logo, contact details and title; the
   orange rule above the contact details runs to the right margin. */
.head-top { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; column-gap: 22px; row-gap: 24px; align-items: center; margin: 0 -13mm; padding: 10mm 13mm 8mm; background: var(--stripes); }
.head-top > .brand { grid-row: 2; grid-column: 1; }
.head-top > .company-contact { grid-row: 2; grid-column: 2; }
.head-top > .doc-title { grid-row: 2; grid-column: 3; }
.brand { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
.logo { display: block; }
/* The orange rule over the contact details and title. */
.head-rule { grid-row: 1; grid-column: 2 / 4; border-top: 2.5px solid var(--accent); }
.company-contact { min-width: 0; font-size: 8.6px; line-height: 1.55; color: var(--ink); }
.company-contact .muted { color: var(--ink-3); font-size: 8px; }
.doc-title { text-align: right; }
.doc-title h1 { margin: 0; font-size: 52px; line-height: 1; font-weight: 700; letter-spacing: -1px; }
.doc-title .subtitle { margin-top: 10px; font-size: 7.6px; letter-spacing: 3.4px; color: var(--ink-2); text-transform: uppercase; }

.parties { display: flex; border-top: 1px solid var(--line); }
.party { flex: 1 1 0; padding: 12px 18px 0 0; min-width: 0; }
/* A column, so the event details can sit at the bottom of it. */
.customer-block { display: flex; flex-direction: column; }
.party + .party { border-left: 1px solid var(--line); padding: 12px 0 0 18px; flex: 0 0 41%; display: flex; flex-direction: column; }
.eyebrow { font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--ink); }
.eyebrow::before { content: ''; display: block; width: 22px; height: 2.5px; background: var(--accent); margin-bottom: 7px; }
.customer-name { display: flex; align-items: center; gap: 7px; margin-top: 12px; font-size: 15px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.4px; word-break: break-word; }
.customer-name svg { flex: 0 0 auto; }
.customer-company { margin-top: 2px; font-size: 10px; color: var(--ink-2); }
.customer-lines { margin-top: 8px; font-size: 9px; color: var(--ink-2); word-break: break-word; }
.customer-row { padding: 7px 0; border-top: 1px solid var(--line); word-break: break-word; }
.customer-row.email { color: var(--accent-ink); }
.customer-row.phone { font-size: 10.5px; font-weight: 500; }
.customer-block > .customer-row:first-of-type { margin-top: 8px; }
.event-block { margin-top: auto; padding: 14px 0 10px; }
.event-title { font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--ink-2); padding-bottom: 5px; margin-bottom: 4px; border-bottom: 1px solid var(--line); }
.event-block .meta-label { flex-basis: 70px; }
.event-block .meta-colon { padding: 0 8px; }
.event-value { flex: 1 1 auto; font-size: 10px; word-break: break-word; }
.meta { margin: 8px 0 12px 22px; }
.meta-row { display: flex; align-items: baseline; padding: 2.5px 0; }
.meta-label { flex: 0 0 82px; font-size: 7.8px; text-transform: uppercase; color: var(--ink-2); }
.meta-colon { flex: 0 0 auto; color: var(--ink-3); padding: 0 10px; }
.meta-value { flex: 1 1 auto; text-align: right; font-size: 10px; word-break: break-word; }
.meta-value.strong { font-size: 12.5px; font-weight: 500; }
.banner { margin-top: auto; display: flex; align-items: center; justify-content: flex-end; gap: 14px; background: var(--dark); border-left: 5px solid var(--accent); padding: 9px 14px; }
.banner-label { font-size: 8.5px; text-transform: uppercase; color: var(--accent); letter-spacing: 0.3px; }
.banner-value { font-size: 21px; color: #fff; font-weight: 400; white-space: nowrap; }
.parties-end { border-bottom: 2px solid var(--accent); }

/* ---------- compact header (page 2+) ---------- */
.cont-head { display: flex; align-items: center; justify-content: space-between; margin: 0 -13mm; padding: 9mm 13mm 12px; background: linear-gradient(var(--accent), var(--accent)) bottom center / calc(100% - 26mm) 2px no-repeat, var(--stripes); }

.cont-right { text-align: right; }
.cont-right .doc-ref { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.cont-right .doc-sub { font-size: 9px; color: var(--ink-3); margin-top: 2px; }

/* ---------- item table ---------- */
/* The item table: the heart of the document, given room to breathe — space
   above the header, taller rows, a small inset from the page edge, and
   13px names and amounts (the same size as the totals). */
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 62px 100px 104px; column-gap: 12px; align-items: center; }
.table-head { padding: 22px 10px 9px; border-bottom: 1px solid var(--line); font-size: 9px; font-weight: 500; text-transform: uppercase; }
.table-head > :first-child::before { content: ''; display: block; width: 22px; height: 2.5px; background: var(--accent); margin-bottom: 7px; }
.table-head .num, .item .num { text-align: right; }
.table-head .qty, .item .qty { text-align: center; }
.section-row { background: var(--band); padding: 9px 10px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 9px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2px; }
.section-row::before { content: ''; width: 4px; height: 13px; background: var(--accent); flex: 0 0 auto; }
.item { padding: 12px 10px; border-bottom: 1px solid var(--line); break-inside: avoid; }
.item-main { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.item-bullet { flex: 0 0 auto; margin-top: 3px; }
.item-name { font-size: 13px; line-height: 1.35; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1px; word-break: break-word; }
.item-desc { margin-top: 3px; font-size: 9.5px; color: var(--ink-2); word-break: break-word; white-space: pre-line; }
.item-discount { margin-top: 3px; font-size: 9.5px; color: var(--discount); }
.item .qty, .item .unit, .item .total { font-size: 13px; }
.item .qty { color: var(--ink-2); }
.item .unit { color: var(--ink-3); }
.item .total { font-weight: 600; }
.item .total s { display: block; font-weight: 400; font-size: 9.5px; color: var(--ink-3); }
/* A clear gap between the last item and the totals below. */
.items-end { height: 20px; }

/* ---------- payment + totals ---------- */
.summary { display: flex; border-top: 2px solid var(--accent); break-inside: avoid; }
.pay { flex: 1 1 auto; padding: 10px 18px 12px 0; border-right: 1px solid var(--line); min-width: 0; }
.pay-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--dark); border-left: 5px solid var(--accent); color: #fff; padding: 8px 12px; font-size: 9px; }
.pay-bar .title { text-transform: uppercase; letter-spacing: 0.2px; }
.pay-bar .ref { color: var(--accent); font-size: 8.5px; white-space: nowrap; }
.pay-rows { padding: 4px 12px 0; }
.pay-row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 8.8px; }
.pay-row .k { flex: 0 0 95px; font-weight: 600; text-transform: uppercase; font-size: 8.2px; }
.pay-row .v { color: var(--ink-2); word-break: break-word; }
.pay-note { padding: 8px 12px 0; color: var(--ink-3); font-size: 8.6px; }
.pay-questions { margin: 10px 12px 0; padding-top: 9px; border-top: 1px solid var(--line); font-size: 8.6px; color: var(--ink-2); }
.pay-questions .q-title { font-size: 8.8px; font-weight: 600; text-transform: uppercase; color: var(--ink); margin-bottom: 2px; }
/* No payment section: the questions + thank-you sit centred beside the totals. */
.pay-none { display: flex; flex-direction: column; justify-content: center; padding-top: 14px; }
.pay-none .pay-questions { border-top: 0; padding-top: 0; margin-top: 0; }
.pay-none .pay-questions .q-title::before { content: ''; display: block; width: 22px; height: 2.5px; background: var(--accent); margin-bottom: 7px; }
.pay-thanks { padding: 6px 12px 0; font-style: italic; color: var(--ink-3); font-size: 11px; }
.totals { flex: 0 0 47%; padding: 14px 0 12px 22px; }
/* Labels at the item text size (13px), matching the amounts. */
.total-row { display: flex; align-items: baseline; padding: 4px 0; font-size: 13px; text-transform: uppercase; color: var(--ink-2); }
.total-row .colon { padding: 0 10px; color: var(--ink-3); }
.total-row .k { flex: 1 1 auto; }
.total-row .v { font-size: 13px; text-transform: none; color: var(--ink); font-weight: 500; white-space: nowrap; }
.total-row.discount, .total-row.discount .v { color: var(--discount); }
.total-row.paid, .total-row.paid .v { color: var(--paid); }
.total-row.strong { border-top: 1px solid var(--line); margin-top: 3px; padding-top: 6px; color: var(--ink); }
.total-row.strong .v { font-weight: 700; }
.grand { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; padding: 12px 0 10px 12px; background: var(--band); border-bottom: 2px solid var(--accent); }
.grand .k { font-size: 13px; color: var(--accent-ink); text-transform: uppercase; }
.grand .v { font-size: 22px; color: var(--accent-ink); font-weight: 500; padding-right: 6px; white-space: nowrap; }
.after-grand { margin-top: 6px; }

/* ---------- notes / terms ---------- */
.band-head { display: flex; justify-content: space-between; align-items: flex-end; background: var(--band); border-top: 2px solid var(--accent); padding: 4px 0 6px; margin-top: 12px; }
.band-head .eyebrow::before { margin-bottom: 6px; }
.band-head .aside { font-size: 8px; color: var(--ink-3); }
.notes-text { padding: 8px 0 2px; font-size: 9px; color: var(--ink-2); white-space: pre-line; word-break: break-word; }
.term { padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 8.8px; word-break: break-word; break-inside: avoid; }
.term:last-child { border-bottom: 0; }
/* Terms in place of the payment section, beside the totals. */
.pay-none.with-terms { justify-content: flex-start; }
.pay-terms { padding: 0 12px; }
.pay-terms .q-title { font-size: 8.8px; font-weight: 600; text-transform: uppercase; color: var(--ink); margin-bottom: 4px; }
.pay-terms .q-title::before { content: ''; display: block; width: 22px; height: 2.5px; background: var(--accent); margin-bottom: 7px; }
.pay-terms .term { font-size: 8.4px; color: var(--ink-2); padding: 4px 0; }

/* ---------- acceptance (quote) ---------- */
.accept { display: flex; break-inside: avoid; }
.accept > div { flex: 1 1 0; padding: 12px 18px 6px 0; }
.accept > div + div { border-left: 1px solid var(--line); padding-left: 22px; padding-right: 0; }
.accept .who { font-size: 8.6px; font-weight: 600; text-transform: uppercase; }
.accept .who.accent { color: var(--accent-ink); }
.accept .statement { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 9px; }
.accept .box { width: 11px; height: 11px; border: 1.3px solid #6b8fd6; flex: 0 0 auto; }
.sign-lines { margin-top: 18px; }
.sign-line { display: flex; align-items: flex-end; gap: 10px; height: 30px; font-size: 8.4px; color: var(--ink-3); }
.sign-line > span:first-child { flex: 0 0 50px; }
.sign-pair .sign-line + .sign-line > span:first-child { flex-basis: auto; }
.sign-line .rule { flex: 1 1 auto; border-bottom: 1px solid var(--ink-2); height: 100%; }
.sign-pair { display: flex; gap: 18px; }
.sign-pair .sign-line { flex: 1 1 0; }

/* ---------- payment status (invoice) ---------- */
.status { display: flex; break-inside: avoid; }
.timeline { flex: 1 1 0; padding: 14px 18px 8px 0; border-right: 1px solid var(--line); }
.step { display: flex; gap: 12px; position: relative; padding-bottom: 12px; }
.step:not(:last-child)::after { content: ''; position: absolute; left: 6.5px; top: 15px; bottom: 0; width: 1px; background: var(--line); }
.dot { flex: 0 0 14px; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
.dot.done { background: var(--paid); }
.dot.current { border: 3.5px solid var(--accent); background: #fff; }
.dot.upcoming { border: 1.5px solid var(--ink-3); }
.step .label { font-size: 8.8px; font-weight: 600; text-transform: uppercase; }
.step .detail { font-size: 8px; color: var(--ink-3); margin-top: 1px; }
.step .value { margin-left: auto; font-weight: 600; font-size: 10px; white-space: nowrap; }
.step.current .value { color: var(--accent); }
.status-side { flex: 0 0 52%; padding: 16px 0 8px 22px; display: flex; flex-direction: column; }
.badge-row { display: flex; gap: 14px; align-items: center; }
.badge { flex: 0 0 auto; border: 1.6px solid var(--discount); color: var(--discount); border-radius: 6px; padding: 7px 16px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; }
.badge.paid { border-color: var(--paid); color: var(--paid); }
.badge.void { border-color: var(--ink-3); color: var(--ink-3); }
.badge-note { font-size: 8.4px; color: var(--ink-3); }
.authorized { margin-top: auto; padding-top: 26px; }
.authorized .sign-line { height: 22px; }
.authorized .for { font-size: 8px; color: var(--ink-3); margin: 5px 0 0 62px; }

/* ---------- footer ---------- */
.page-foot { margin: auto -13mm 0; padding: 11px 13mm 9mm; background: linear-gradient(var(--accent), var(--accent)) top center / calc(100% - 26mm) 2.5px no-repeat, var(--stripes); display: flex; gap: 14px; font-size: 7.6px; color: var(--ink-2); flex: 0 0 auto; }
.foot-note { flex: 1 1 36%; }
.foot-note .page-no { margin-top: 6px; color: var(--accent-ink); font-weight: 600; font-size: 7.8px; letter-spacing: 0.3px; }
.foot-mid { flex: 1 1 32%; border-left: 1px solid var(--line); padding-left: 14px; }
.foot-mid .services { font-weight: 600; color: var(--ink); font-size: 7.4px; }
.foot-right { flex: 1 1 32%; display: flex; justify-content: flex-end; gap: 8px; border-left: 1px solid var(--line); padding-left: 14px; text-align: right; }
`;
