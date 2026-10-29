// The receipt a client gets for a payment, when staff choose to send one:
// a thank-you, the payment, what's left to pay, and the up-to-date invoice
// PDF attached. Same inline-styled look as the quote email; every value
// from the invoice is escaped.
import type { InvoiceDto, InvoicePaymentDto } from '../db/invoiceRepo';
import type { DocumentConfig } from './documentConfig';
import { escapeHtml as esc } from '../documents/html/jsx-runtime';
import { formatCents } from '../money';
import { documentDate } from './format';
import { INVOICE_PAYMENT_KIND_LABELS, INVOICE_PAYMENT_METHOD_LABELS } from './types';

export interface ReceiptEmailContent {
  subject: string;
  html: string;
  text: string;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

export function receiptEmailContent(inv: InvoiceDto, payment: InvoicePaymentDto, config: DocumentConfig): ReceiptEmailContent {
  const paidInFull = inv.balanceDueCents <= 0;
  const subject = `Payment received — ${inv.invoiceNumber}${inv.eventName ? ` · ${inv.eventName}` : ''}`;
  const hello = `Hi ${firstName(inv.customerName)},`;
  const intro = `Thank you — we’ve received your ${INVOICE_PAYMENT_KIND_LABELS[payment.kind].toLowerCase()} of ${formatCents(payment.amountCents)} for invoice ${inv.invoiceNumber}${inv.eventName ? ` (${inv.eventName})` : ''}.`;
  const status = paidInFull ? 'Your invoice is now paid in full.' : `The remaining balance of ${formatCents(inv.balanceDueCents)} is due by ${documentDate(inv.dueDate)}.`;
  const contact = [config.phones[0], config.email].filter(Boolean).join(' · ');
  const questions = `Questions? Just reply to this email${contact ? ` or contact us at ${contact}` : ''}. The updated invoice is attached.`;

  const rows: [string, string][] = [
    ['Amount received', `${formatCents(payment.amountCents)} ${inv.currency}`],
    ['Date received', documentDate(payment.receivedOn)],
    ...(payment.method ? [['Paid by', INVOICE_PAYMENT_METHOD_LABELS[payment.method]] as [string, string]] : []),
    ...(payment.reference ? [['Reference', payment.reference] as [string, string]] : []),
    ['Invoice total', formatCents(inv.totalCents)],
    ['Paid to date', formatCents(inv.depositPaidCents + inv.amountPaidCents)],
    ['Balance due', paidInFull ? 'Paid in full' : formatCents(inv.balanceDueCents)],
  ];

  const text = [hello, '', intro, status, '', ...rows.map(([l, v]) => `${l}: ${v}`), '', questions, '', config.companyName, ...(config.website ? [config.website] : [])].join('\n');

  const rowHtml = rows
    .map(
      ([l, v], i) =>
        `<tr><td style="padding:8px 0;color:#55555b;font-size:14px;${i ? 'border-top:1px solid #e6e4df;' : ''}">${esc(l)}</td><td align="right" style="padding:8px 0;font-size:14px;font-weight:600;color:#1f1f22;${i ? 'border-top:1px solid #e6e4df;' : ''}">${esc(v)}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f7f7f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f5;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f1f22;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e4df;border-radius:16px;">
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b85f07;">${esc(config.companyName)}</p>
<p style="margin:0 0 18px;font-size:22px;font-weight:700;">Payment received</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${esc(hello)}</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${esc(intro)}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5;font-weight:600;">${esc(status)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">${rowHtml}</table>
<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#55555b;">${esc(questions)}</p>
</td></tr>
<tr><td style="padding:18px 28px 26px;font-size:13px;color:#8b8b91;">${esc(config.companyName)}${config.website ? ` · ${esc(config.website)}` : ''}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { subject, html, text };
}
