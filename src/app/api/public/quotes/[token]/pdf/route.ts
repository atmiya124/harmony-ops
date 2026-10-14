import { NextResponse } from 'next/server';
import { quoteIdForToken } from '@/lib/db/clientLinkRepo';
import { pdfErrorResponse, quotePdfResponse } from '@/lib/documents/pdfResponse';

interface Params {
  params: Promise<{ token: string }>;
}

export const maxDuration = 60;

// Public: the client's quote as a PDF (?download=1 to save it).
export async function GET(req: Request, { params }: Params) {
  const { token } = await params;
  try {
    const id = await quoteIdForToken(token);
    if (!id) return NextResponse.json({ error: 'This quote link isn’t valid.' }, { status: 404 });
    return await quotePdfResponse(id, new URL(req.url).searchParams.get('download') === '1');
  } catch (err) {
    return pdfErrorResponse(err, 'public quote pdf');
  }
}
