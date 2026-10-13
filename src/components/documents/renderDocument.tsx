/** @jsxImportSource @/lib/documents/html */
import type { DocumentModel } from '@/lib/documents/documentModel';
import { DOCUMENT_CSS } from '@/lib/documents/documentStyles';
import { LAYOUT_SCRIPT } from '@/lib/documents/layoutScript';
import { escapeHtml } from '@/lib/documents/html/jsx-runtime';
import { DocumentShell } from './DocumentParts';

// A complete, self-contained HTML document (fonts and styles inline, no
// external requests) for the headless browser to lay out and print.
export function renderDocumentHtml(doc: DocumentModel): string {
  const body = String(<DocumentShell doc={doc} />);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(doc.fileName)}</title><style>${DOCUMENT_CSS}</style></head><body>${body}<script>${LAYOUT_SCRIPT}</script></body></html>`;
}
