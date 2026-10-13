import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { setQuoteStatus } from '@/lib/db/quoteRepo';
import { quoteStatusInputSchema } from '@/lib/schemas/quote';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

// Marks a quote Draft / Sent / Accepted / Declined / Expired by hand.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  const body = parseBody(quoteStatusInputSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await setQuoteStatus(id, body.data, partner));
  } catch (err) {
    return financeErrorResponse(err, 'change quote status');
  }
});
