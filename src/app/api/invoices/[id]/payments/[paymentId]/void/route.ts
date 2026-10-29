import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { voidInvoicePayment } from '@/lib/db/invoicePaymentRepo';
import { voidPaymentSchema } from '@/lib/schemas/invoice';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string; paymentId: string }>;
}

// Undoes a payment recorded by mistake. Returns the invoice.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id, paymentId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(paymentId).success) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  const body = parseBody(voidPaymentSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await voidInvoicePayment(id, paymentId, body.data, partner));
  } catch (err) {
    return financeErrorResponse(err, 'undo invoice payment');
  }
});
