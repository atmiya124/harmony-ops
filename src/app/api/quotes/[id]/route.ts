import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { getQuote, updateQuote } from '@/lib/db/quoteRepo';
import { quoteUpdateSchema } from '@/lib/schemas/quote';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

const idSchema = z.uuid();

async function quoteId(params: Params['params']): Promise<string | null> {
  const { id } = await params;
  return idSchema.safeParse(id).success ? id : null;
}

const notFound = () => NextResponse.json({ error: 'Quote not found' }, { status: 404 });

export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const id = await quoteId(params);
  if (!id) return notFound();
  try {
    const quote = await getQuote(id);
    return quote ? NextResponse.json(quote) : notFound();
  } catch (err) {
    return financeErrorResponse(err, 'load quote');
  }
});

// Replaces the quote's details and items; totals are recalculated here.
export const PATCH = withPartner<Request, Params>(async (req, { params, partner }) => {
  const id = await quoteId(params);
  if (!id) return notFound();
  const body = parseBody(quoteUpdateSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await updateQuote(id, body.data, partner));
  } catch (err) {
    return financeErrorResponse(err, 'update quote');
  }
});
