import { NextResponse } from 'next/server';
import { acceptQuoteByLink } from '@/lib/db/clientLinkRepo';
import { quoteAcceptInputSchema } from '@/lib/schemas/clientQuote';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';
import { requestMeta, tooLarge } from '@/lib/api/requestMeta';

interface Params {
  params: Promise<{ token: string }>;
}

// Public: the client accepts the quote (name, ticked terms, signature).
// Everything is checked again here; the quote comes only from the token.
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  if (tooLarge(req, 300_000)) return NextResponse.json({ error: 'That signature is too large. Please clear it and sign again.' }, { status: 413 });
  const body = parseBody(quoteAcceptInputSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await acceptQuoteByLink(token, body.data, requestMeta(req), todayInFinanceTz()));
  } catch (err) {
    return financeErrorResponse(err, 'accept quote');
  }
}
