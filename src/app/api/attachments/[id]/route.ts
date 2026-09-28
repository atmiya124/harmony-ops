import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { openAttachment } from '@/lib/db/financeRepo';

interface Params {
  params: Promise<{ id: string }>;
}

// Streams a private receipt to a signed-in partner. Storage keys and blob
// URLs are never exposed; this route is the only way to read a file.
export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const { id } = await params;
  const notFound = NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  if (!z.uuid().safeParse(id).success) return notFound;
  try {
    const receipt = await openAttachment(id);
    if (!receipt) return notFound;
    const headers = new Headers({
      'Content-Type': receipt.contentType, // the validated type recorded at upload
      'Content-Disposition': `inline; filename="receipt-${id}.${receipt.extension}"`,
      // Financial documents: never cached by shared caches or CDNs.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    // Images can't run anything, but lock them down anyway; PDFs keep the
    // browser's built-in viewer (which a sandbox CSP would break).
    if (receipt.contentType.startsWith('image/')) headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    return new Response(receipt.file.body, { headers });
  } catch (err) {
    console.error('[finance] open receipt failed:', err);
    return NextResponse.json({ error: 'Could not load the receipt' }, { status: 500 });
  }
});
