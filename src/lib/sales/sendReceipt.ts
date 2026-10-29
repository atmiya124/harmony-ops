// Emails a payment receipt to the client — only ever because staff asked
// (a box ticked when recording the payment, or "Send receipt" later). The
// up-to-date invoice PDF is attached. Checked first: the client has an
// email, the payment is live, and email is set up.
import { getInvoice, type InvoiceDto } from '../db/invoiceRepo';
import { markReceiptSent } from '../db/invoicePaymentRepo';
import { FinanceError, nowIso } from '../db/financeRepo';
import { invoiceDocument } from '../documents/documentModel';
import { renderPdf } from '../documents/renderPdf';
import { renderDocumentHtml } from '@/components/documents/renderDocument';
import { EmailError, isEmailConfigured, sendEmail } from '../email/resend';
import { DOCUMENT_CONFIG, type DocumentConfig } from './documentConfig';
import { receiptEmailContent } from './receiptEmail';

// `sendId` makes a retried click send one email (Resend's idempotency key).
export async function sendPaymentReceipt(invoiceId: string, paymentId: string, sendId: string, config: DocumentConfig = DOCUMENT_CONFIG): Promise<InvoiceDto> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new FinanceError(404, 'Invoice not found');
  const payment = invoice.payments.find((p) => p.id === paymentId);
  if (!payment) throw new FinanceError(404, 'Payment not found');
  if (payment.voidedAt) throw new FinanceError(409, 'This payment was undone, so it has no receipt.');
  if (!invoice.customerEmail) throw new FinanceError(422, 'This invoice has no client email to send the receipt to.');
  if (!isEmailConfigured()) throw new EmailError('Email isn’t set up yet. Add RESEND_API_KEY and QUOTE_EMAIL_FROM to the environment.', 503);

  const doc = invoiceDocument(invoice, config);
  const { pdf } = await renderPdf(renderDocumentHtml(doc));
  const content = receiptEmailContent(invoice, payment, config);
  await sendEmail({
    to: invoice.customerEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    replyTo: config.email,
    attachments: [{ filename: doc.fileName, content: pdf }],
    idempotencyKey: `receipt-${sendId}`,
  });

  // The email has gone; failing to note it mustn't report a failed send.
  try {
    await markReceiptSent(paymentId, invoice.customerEmail, nowIso());
  } catch (err) {
    console.error('[email] receipt sent but could not be noted on the payment:', err);
  }
  return (await getInvoice(invoiceId))!;
}
