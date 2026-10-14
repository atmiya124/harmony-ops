// The email a client receives with their quote: a short note, the headline
// figures, a "View & accept your quote" button (their secret link) and the
// PDF attached. Plain inline-styled HTML (what email clients support) plus a
// text version. Every value from the quote is escaped.
import type { QuoteDto } from '../db/quoteRepo';
import type { DocumentConfig } from './documentConfig';
import { escapeHtml as esc } from '../documents/html/jsx-runtime';
import { formatCents } from '../money';
import { formatBp } from './inputs';
import { documentDate } from './format';

export interface QuoteEmailContent {
  subject: string;
  html: string;
  text: string;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

export function quoteEmailSubject(q: QuoteDto, config: DocumentConfig): string {
  return `Your quote from ${config.companyName} — ${q.quoteNumber}${q.eventName ? ` · ${q.eventName}` : ''}`;
}

// The figures shown in the email, label → value.
function figures(q: QuoteDto): [string, string][] {
  const totalLabel = q.paymentMethod === 'cash' ? `Total estimate (cash, no ${q.taxLabel})` : `Total estimate (incl. ${q.taxLabel})`;
  const rows: [string, string][] = [[totalLabel, `${formatCents(q.totalCents)} ${q.currency}`]];
  if (q.depositType !== 'none' && q.depositRequiredCents > 0) {
    rows.push([`Deposit to book${q.depositType === 'percent' ? ` (${formatBp(q.depositValue)})` : ''}`, formatCents(q.depositRequiredCents)]);
  }
  if (q.eventDate) rows.push(['Event date', documentDate(q.eventDate)]);
  rows.push(['Valid until', documentDate(q.validUntil)]);
  return rows;
}

export function quoteEmailContent(q: QuoteDto, linkUrl: string, config: DocumentConfig): QuoteEmailContent {
  const subject = quoteEmailSubject(q, config);
  const hello = `Hi ${firstName(q.customerName)},`;
  const intro = `Thank you for considering ${config.companyName}. Your quote ${q.quoteNumber}${q.eventName ? ` for ${q.eventName}` : ''} is ready.`;
  const how = 'You can review it and accept it online with the button below. A PDF copy is attached.';
  const contact = [config.phones[0], config.email].filter(Boolean).join(' · ');
  const questions = `Questions? Just reply to this email${contact ? ` or contact us at ${contact}` : ''}.`;
  const rows = figures(q);

  const text = [
    hello,
    '',
    intro,
    how,
    '',
    ...rows.map(([l, v]) => `${l}: ${v}`),
    '',
    `View & accept your quote: ${linkUrl}`,
    '',
    questions,
    '',
    config.companyName,
    ...(config.website ? [config.website] : []),
  ].join('\n');

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
<p style="margin:0 0 18px;font-size:22px;font-weight:700;">Quote ${esc(q.quoteNumber)}</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${esc(hello)}</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${esc(intro)}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5;">${esc(how)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">${rowHtml}</table>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#f0861e;">
<a href="${esc(linkUrl)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#1f1f22;text-decoration:none;border-radius:999px;">View &amp; accept your quote</a>
</td></tr></table>
<p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#55555b;">${esc(questions)}</p>
</td></tr>
<tr><td style="padding:18px 28px 26px;font-size:13px;color:#8b8b91;">${esc(config.companyName)}${config.website ? ` · ${esc(config.website)}` : ''}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { subject, html, text };
}
