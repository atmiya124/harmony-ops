import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { quotePdfResponse, pdfErrorResponse } from '@/lib/documents/pdfResponse';

interface Params {
  params: Promise<{ id: string }>;
}

// Headless Chromium needs more than the default time on a cold start.
export const maxDuration = 60;

// The quote as a PDF: shown in the browser, or saved with ?download=1.
export const GET = withPartner<Request, Params>(async (req, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  const download = new URL(req.url).searchParams.get('download') === '1';
  try {
    return await quotePdfResponse(id, download);
  } catch (err) {
    return pdfErrorResponse(err, 'quote pdf');
  }
});
