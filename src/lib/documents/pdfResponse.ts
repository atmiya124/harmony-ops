// Builds the HTTP response for a quote or invoice PDF: loads the saved record
// on the server, maps it to the document, renders, and names the file. The
// route handlers add authentication and id validation around this.
import { NextResponse } from 'next/server';
import { getQuote } from '../db/quoteRepo';
import { getInvoice } from '../db/invoiceRepo';
import { getAcceptanceForDocument } from '../db/clientLinkRepo';
import { DOCUMENT_CONFIG, type DocumentConfig } from '../sales/documentConfig';
import { invoiceDocument, quoteDocument, type DocumentModel } from './documentModel';
import { renderDocumentHtml } from '@/components/documents/renderDocument';
import { renderPdf } from './renderPdf';

async function pdfResponse(doc: DocumentModel, download: boolean): Promise<Response> {
  const { pdf } = await renderPdf(renderDocumentHtml(doc));
  // fileName is already limited to letters, digits, - and _ (documentFileName).
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${doc.fileName}"`,
      'Content-Length': String(pdf.byteLength),
      // Customer data: never stored by shared caches.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function quotePdfResponse(id: string, download: boolean, config: DocumentConfig = DOCUMENT_CONFIG): Promise<Response> {
  const [quote, accepted] = await Promise.all([getQuote(id), getAcceptanceForDocument(id)]);
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  return pdfResponse(quoteDocument(quote, config, accepted), download);
}

export async function invoicePdfResponse(id: string, download: boolean, config: DocumentConfig = DOCUMENT_CONFIG): Promise<Response> {
  const invoice = await getInvoice(id);
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  return pdfResponse(invoiceDocument(invoice, config), download);
}

// Shared by both routes: unexpected failures are logged, never shown.
export function pdfErrorResponse(err: unknown, context: string): Response {
  console.error(`[pdf] ${context} failed:`, err);
  return NextResponse.json({ error: 'Could not create the PDF. Please try again.' }, { status: 500 });
}
