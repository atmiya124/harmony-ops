import { NextResponse } from 'next/server';
import { declineQuoteByLink } from '@/lib/db/clientLinkRepo';
import { quoteDeclineInputSchema } from '@/lib/schemas/clientQuote';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';
import { requestMeta, tooLarge } from '@/lib/api/requestMeta';

interface Params {
  params: Promise<{ token: string }>;
}

// Public: the client declines the quote, optionally saying why.
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  if (tooLarge(req, 20_000)) return NextResponse.json({ error: 'Please shorten your message.' }, { status: 413 });
  const body = parseBody(quoteDeclineInputSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await declineQuoteByLink(token, body.data, requestMeta(req), todayInFinanceTz()));
  } catch (err) {
    return financeErrorResponse(err, 'decline quote');
  }
}
