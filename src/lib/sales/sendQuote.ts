// Emails a quote to the client: their secret link (the live one, or a new
// one) and the PDF attached. A draft becomes Sent. Checked before anything
// happens: the client has an email, the quote can be sent, it's the version
// on screen, and email is set up.
import { getQuote, recordQuoteEmailSend, setQuoteStatus, type QuoteDto } from '../db/quoteRepo';
import { createClientLink, getStaffClientLink } from '../db/clientLinkRepo';
import { FinanceError, type Actor } from '../db/financeRepo';
import { quoteDocument } from '../documents/documentModel';
import { renderPdf } from '../documents/renderPdf';
import { renderDocumentHtml } from '@/components/documents/renderDocument';
import { todayInFinanceTz } from '../finance/today';
import { EmailError, emailConfigDiagnostics, isEmailConfigured, sendEmail } from '../email/resend';
import { DOCUMENT_CONFIG, type DocumentConfig } from './documentConfig';
import { quoteEmailContent } from './quoteEmail';
import { EMAILABLE_QUOTE_STATUSES, QUOTE_STATUS_LABELS } from './types';

const stale = 'Someone else changed this quote. Review their changes and try again.';

export async function sendQuoteEmail(
  id: string,
  input: { expectedUpdatedAt: string; sendId: string },
  actor: Actor,
  origin: string,
  config: DocumentConfig = DOCUMENT_CONFIG,
): Promise<QuoteDto> {
  const quote = await getQuote(id);
  if (!quote) throw new FinanceError(404, 'Quote not found');
  if (quote.updatedAt !== input.expectedUpdatedAt) throw new FinanceError(409, stale, undefined, quote);
  if (!quote.customerEmail) throw new FinanceError(422, 'Add the client’s email to the quote before sending it.');
  if (!EMAILABLE_QUOTE_STATUSES.includes(quote.status)) throw new FinanceError(409, `${QUOTE_STATUS_LABELS[quote.status]} quotes can’t be sent.`);
  if (quote.validUntil < todayInFinanceTz()) throw new FinanceError(409, 'This quote has expired. Update its valid-until date before sending it.');
  if (!isEmailConfigured()) {
    // TEMPORARY-EMAIL-DIAGNOSTICS (no secrets: presence, lengths, names).
    const d = emailConfigDiagnostics();
    console.warn('[email] not configured:', d);
    const seen = `server sees RESEND_API_KEY ${d.hasResendKey ? `set (${d.resendKeyLength} chars)` : 'missing'}, QUOTE_EMAIL_FROM ${d.hasQuoteFrom ? `set (${d.quoteFromLength} chars)` : 'missing'}; similar names: ${d.similarNames.join(', ') || 'none'}; env ${d.vercelEnv ?? 'local'}, build ${d.commit ?? 'local'}, ${d.runtime}`;
    throw new EmailError(`Email isn’t set up yet. Add RESEND_API_KEY and QUOTE_EMAIL_FROM to the environment. [${seen}]`, 503);
  }

  // The PDF first: if it fails, nothing has changed yet.
  const { pdf } = await renderPdf(renderDocumentHtml(quoteDocument(quote, config)));

  // The client's live link, or a new one (which also marks a draft Sent).
  let path = (await getStaffClientLink(id)).link?.path ?? null;
  if (!path) path = (await createClientLink(id, actor)).path;
  if (!path) throw new Error('Client link could not be created');

  const content = quoteEmailContent(quote, `${origin}${path}`, config);
  const { id: providerMessageId } = await sendEmail({
    to: quote.customerEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    replyTo: config.email,
    attachments: [{ filename: quoteDocument(quote, config).fileName, content: pdf }],
    idempotencyKey: `quote-send-${input.sendId}`,
  });

  // Only now, with the provider's acceptance, is it a send. If recording
  // fails the email has still gone, so staff aren't told to send it again.
  try {
    await recordQuoteEmailSend(id, { recipientEmail: quote.customerEmail, providerMessageId }, actor);
  } catch (err) {
    console.error('[email] quote sent but its send history could not be saved:', err);
  }

  // An existing link on a quote moved back to Draft: sending sends it.
  const now = (await getQuote(id))!;
  if (now.status === 'draft') return setQuoteStatus(id, { status: 'sent', expectedUpdatedAt: now.updatedAt }, actor);
  return now;
}
