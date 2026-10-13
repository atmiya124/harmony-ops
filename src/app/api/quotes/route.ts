import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { createQuote, listQuotes } from '@/lib/db/quoteRepo';
import { quoteCreateSchema } from '@/lib/schemas/quote';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

// Newest first.
export const GET = withPartner(async () => {
  try {
    return NextResponse.json(await listQuotes());
  } catch (err) {
    return financeErrorResponse(err, 'list quotes');
  }
});

// Saves a new draft. The number, status and every total are set here on the
// server; any totals in the body are ignored.
export const POST = withPartner(async (req, { partner }) => {
  const body = parseBody(quoteCreateSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    const { quote, created } = await createQuote(body.data, partner);
    return NextResponse.json(quote, { status: created ? 201 : 200 });
  } catch (err) {
    return financeErrorResponse(err, 'create quote');
  }
});
