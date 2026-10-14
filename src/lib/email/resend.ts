// Sends email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Plain fetch, no SDK. Configured by two environment variables:
//   RESEND_API_KEY    the API key
//   QUOTE_EMAIL_FROM  the sender, on a domain verified in Resend, e.g.
//                     "Harmony Production <quotes@harmonyproduction.ca>"
// Server only: the key must never reach the browser.

const RESEND_URL = 'https://api.resend.com/emails';

export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
  // Same key within 24 hours = Resend sends it only once (a retried click).
  idempotencyKey?: string;
}

export class EmailError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function emailSender(): string | null {
  return process.env.QUOTE_EMAIL_FROM?.trim() || null;
}

// TEMPORARY-EMAIL-DIAGNOSTICS: what the running server sees, without any
// secret — presence and length only, plus the *names* of look-alike
// variables (a typo or stray space in a name shows up here).
export function emailConfigDiagnostics() {
  const key = process.env.RESEND_API_KEY?.trim() ?? '';
  const from = process.env.QUOTE_EMAIL_FROM?.trim() ?? '';
  return {
    hasResendKey: key.length > 0,
    resendKeyLength: key.length,
    hasQuoteFrom: from.length > 0,
    quoteFromLength: from.length,
    similarNames: Object.keys(process.env)
      .filter((name) => /resend|email_from|quote_email/i.test(name))
      .map((name) => JSON.stringify(name)),
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    runtime: typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime === 'string' ? 'edge' : `node ${process.version}`,
  };
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && emailSender());
}

export async function sendEmail(email: OutgoingEmail): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = emailSender();
  if (!key || !from) throw new EmailError('Email isn’t set up yet (RESEND_API_KEY and QUOTE_EMAIL_FROM).', 503);

  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(email.idempotencyKey ? { 'Idempotency-Key': email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        ...(email.attachments?.length
          ? { attachments: email.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })) }
          : {}),
      }),
    });
  } catch (err) {
    console.error('[email] Resend request failed:', err);
    throw new EmailError('Couldn’t reach the email service. Please try again.', 502);
  }

  const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok || !body?.id) {
    console.error('[email] Resend refused the email:', res.status, body);
    // Resend's messages are safe to show (e.g. an unverified domain).
    throw new EmailError(body?.message ? `The email service said: ${body.message}` : 'The email couldn’t be sent. Please try again.', 502);
  }
  return { id: body.id };
}
