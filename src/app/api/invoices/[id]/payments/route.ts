import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { recordInvoicePayment } from '@/lib/db/invoicePaymentRepo';
import { invoicePaymentSchema } from '@/lib/schemas/invoice';
import { sendPaymentReceipt } from '@/lib/sales/sendReceipt';
import { EmailError } from '@/lib/email/resend';
import { FinanceError } from '@/lib/db/financeRepo';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

// Sending a receipt renders the PDF, which needs time on a cold start.
export const maxDuration = 60;

// Records a payment. When `sendReceipt` is set, a receipt is emailed after
// the payment is saved; if that email fails the payment still stands, and
// `receipt.error` says why so staff can send it again later.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  const body = parseBody(invoicePaymentSchema, await readJson(req));
  if (!body.ok) return body.response;
  let invoice;
  try {
    invoice = await recordInvoicePayment(id, body.data, todayInFinanceTz(), partner);
  } catch (err) {
    return financeErrorResponse(err, 'record invoice payment');
  }
  if (!body.data.sendReceipt) return NextResponse.json({ invoice, receipt: null }, { status: 201 });
  try {
    invoice = await sendPaymentReceipt(id, body.data.paymentId, body.data.paymentId);
    return NextResponse.json({ invoice, receipt: { sent: true, to: invoice.customerEmail } }, { status: 201 });
  } catch (err) {
    console.error(`[email] receipt for payment ${body.data.paymentId} failed:`, err);
    // Email and rule problems have messages meant for staff.
    const error = err instanceof EmailError || err instanceof FinanceError ? err.message : 'The receipt couldn’t be sent.';
    return NextResponse.json({ invoice, receipt: { sent: false, error } }, { status: 201 });
  }
});
