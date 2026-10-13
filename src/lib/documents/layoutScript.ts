// Runs inside the headless browser, before the PDF is printed. It copies the
// document's blocks (DocumentShell's #flow) into fixed A4 pages, measuring
// the real rendered height of each one, so page breaks come from the
// content — nothing is assigned to a page in advance. Rules:
//   - page 1 gets the full header, later pages the compact one; every page
//     gets the footer, numbered "PAGE X OF Y" once the count is known
//   - the item table header repeats on every page that has item rows
//   - a section header is never left alone at the bottom of a page: it
//     moves to the next page with its first item
//   - when a section runs onto a new page, its header is repeated there as
//     "SECTION (CONTINUED)"
//   - blocks (totals + payment, acceptance, payment status) are never split;
//     a heading stays with what follows it; terms may run onto a new page
//     one whole term at a time, under "TERMS & CONDITIONS (CONTINUED)"
// The result is left on window.__layout for the PDF renderer (and tests).
//
// Plain JavaScript in a string, so what runs in the page is exactly this
// (no bundler or TypeScript output in between).

export interface PageLayout {
  items: number;
  continued: string[]; // sections repeated as "(continued)" at the top
  kinds: string[]; // data-flow kinds placed, in order
  overflow: boolean; // something taller than a whole page was forced in
  pageLabel: string; // the footer's "PAGE X OF Y"
}

export interface DocumentLayout {
  pageCount: number;
  pages: PageLayout[];
}

export const LAYOUT_SCRIPT = String.raw`
(function () {
  function run() {
    var flow = document.getElementById('flow');
    var pagesRoot = document.getElementById('pages');
    function part(name) { return flow.querySelector('[data-part="' + name + '"]'); }
    var firstHead = part('first-head');
    var contHead = part('cont-head');
    var tableHead = part('table-head');
    var footer = part('footer');
    var blocks = Array.prototype.slice.call(part('content').children);
    var pages = [];
    var body = null;
    var info = null;

    function newPage() {
      var page = document.createElement('section');
      page.className = 'page';
      page.appendChild((pages.length ? contHead : firstHead).cloneNode(true));
      body = document.createElement('div');
      body.className = 'page-body';
      page.appendChild(body);
      page.appendChild(footer.cloneNode(true));
      pagesRoot.appendChild(page);
      info = { items: 0, continued: [], kinds: [], overflow: false, pageLabel: '' };
      pages.push(info);
    }

    function overflows() { return body.scrollHeight > body.clientHeight + 1; }

    // Adds copies of the nodes; takes them back out if they don't fit,
    // unless forced (something taller than an empty page).
    function tryPlace(nodes, force) {
      var copies = nodes.map(function (n) { return n.cloneNode(true); });
      copies.forEach(function (c) { body.appendChild(c); });
      if (!overflows()) return true;
      if (force) { info.overflow = true; return true; }
      copies.forEach(function (c) { c.remove(); });
      return false;
    }

    function continuedHeader(sectionEl) {
      var row = sectionEl.cloneNode(true);
      row.querySelector('.section-name').textContent += ' (continued)';
      row.setAttribute('data-flow', 'section-continued');
      return row;
    }

    var currentSection = null;
    var currentBand = null;
    var i = 0;
    newPage();
    while (i < blocks.length) {
      var el = blocks[i];
      var kind = el.getAttribute('data-flow');
      var fresh = body.children.length === 0;
      if (kind === 'items-end' && fresh) { i++; continue; } // closing rule only
      var group = [el];
      if ((kind === 'section' || kind === 'band-head') && blocks[i + 1]) group.push(blocks[i + 1]);
      // A terms heading takes at least two terms with it, so a page never
      // ends on a heading and a single stray term.
      if (kind === 'band-head' && blocks[i + 1] && blocks[i + 1].getAttribute('data-flow') === 'term' && blocks[i + 2] && blocks[i + 2].getAttribute('data-flow') === 'term') group.push(blocks[i + 2]);
      var prefix = [];
      if ((kind === 'section' || kind === 'item') && !body.querySelector('[data-part="table-head"]')) prefix.push(tableHead);
      var continued = kind === 'item' && fresh && currentSection ? currentSection : null;
      if (continued) prefix.push(continuedHeader(continued));
      // Terms running onto a new page get their heading again too.
      if (kind === 'term' && fresh && currentBand) {
        var band = currentBand.cloneNode(true);
        band.querySelector('.eyebrow').textContent += ' (continued)';
        band.setAttribute('data-flow', 'band-head-continued');
        prefix.push(band);
      }

      if (!tryPlace(prefix.concat(group), false)) {
        if (!fresh) { newPage(); continue; }
        // Too tall even for an empty page: place the first block alone.
        group = [el];
        tryPlace(prefix.concat(group), true);
      }
      if (continued) info.continued.push(continued.getAttribute('data-section'));
      group.forEach(function (g) {
        var k = g.getAttribute('data-flow');
        if (k === 'section') currentSection = g;
        if (k === 'band-head') currentBand = g;
        if (k === 'item') info.items++;
        info.kinds.push(k);
      });
      i += group.length;
    }

    var total = pages.length;
    Array.prototype.forEach.call(pagesRoot.querySelectorAll('.page-no'), function (n, index) {
      n.textContent = 'PAGE ' + (index + 1) + ' OF ' + total;
      pages[index].pageLabel = n.textContent;
    });
    flow.remove();
    window.__layout = { pageCount: total, pages: pages };
  }
  // Measure only once the embedded fonts are in use.
  document.fonts.ready.then(run);
})();
`;
