import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { sendPaymentReceipt } from '@/lib/sales/sendReceipt';
import { EmailError } from '@/lib/email/resend';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string; paymentId: string }>;
}

// Rendering the PDF needs more than the default time on a cold start.
export const maxDuration = 60;

// One per click in the browser, so a retried request sends only once.
const receiptSchema = z.object({ sendId: z.uuid('Invalid send id') });

// Emails (or re-emails) the receipt for one payment. Returns the invoice.
export const POST = withPartner<Request, Params>(async (req, { params }) => {
  const { id, paymentId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(paymentId).success) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  const body = parseBody(receiptSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await sendPaymentReceipt(id, paymentId, body.data.sendId));
  } catch (err) {
    if (err instanceof EmailError) return NextResponse.json({ error: err.message }, { status: err.status });
    return financeErrorResponse(err, 'send payment receipt');
  }
});
