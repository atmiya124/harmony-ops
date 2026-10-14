import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { cloneQuote } from '@/lib/db/quoteRepo';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

// The new quote's id, generated in the browser so a retry can't make two.
const cloneSchema = z.object({ id: z.uuid('Invalid quote id') });

// Copies the quote into a new draft dated today.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  const body = parseBody(cloneSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await cloneQuote(id, body.data.id, todayInFinanceTz(), partner), { status: 201 });
  } catch (err) {
    return financeErrorResponse(err, 'clone quote');
  }
});
