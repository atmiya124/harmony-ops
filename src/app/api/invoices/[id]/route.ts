import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { getInvoice, updateInvoicePo } from '@/lib/db/invoiceRepo';
import { invoicePoSchema } from '@/lib/schemas/invoice';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

const notFound = () => NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  try {
    const invoice = await getInvoice(id);
    return invoice ? NextResponse.json(invoice) : notFound();
  } catch (err) {
    return financeErrorResponse(err, 'load invoice');
  }
});

// The only field an invoice takes after it's made: the client's PO number.
export const PATCH = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  const body = parseBody(invoicePoSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await updateInvoicePo(id, body.data, partner));
  } catch (err) {
    return financeErrorResponse(err, 'update invoice PO');
  }
});
