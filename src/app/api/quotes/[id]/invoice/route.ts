import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { convertQuoteToInvoice } from '@/lib/db/invoiceRepo';
import { quoteConvertSchema } from '@/lib/schemas/invoice';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

// Converts an accepted quote into its invoice, dated today. Returns the
// quote, now Converted and listing the new invoice.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  const body = parseBody(quoteConvertSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await convertQuoteToInvoice(id, body.data, todayInFinanceTz(), partner), { status: 201 });
  } catch (err) {
    return financeErrorResponse(err, 'convert quote to invoice');
  }
});
