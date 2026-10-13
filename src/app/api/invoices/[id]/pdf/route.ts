import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { invoicePdfResponse, pdfErrorResponse } from '@/lib/documents/pdfResponse';

interface Params {
  params: Promise<{ id: string }>;
}

// Headless Chromium needs more than the default time on a cold start.
export const maxDuration = 60;

// The invoice as a PDF: shown in the browser, or saved with ?download=1.
export const GET = withPartner<Request, Params>(async (req, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  const download = new URL(req.url).searchParams.get('download') === '1';
  try {
    return await invoicePdfResponse(id, download);
  } catch (err) {
    return pdfErrorResponse(err, 'invoice pdf');
  }
});
