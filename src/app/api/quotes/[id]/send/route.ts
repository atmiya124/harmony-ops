import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { sendQuoteEmail } from '@/lib/sales/sendQuote';
import { EmailError } from '@/lib/email/resend';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

// Rendering the PDF needs more than the default time on a cold start.
export const maxDuration = 60;

const sendSchema = z.object({
  expectedUpdatedAt: z.string().min(1, 'Missing version'),
  // One per click in the browser, so a retried request sends only once.
  sendId: z.uuid('Invalid send id'),
});

// Emails the quote to the client's address: the client link and the PDF.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  const body = parseBody(sendSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await sendQuoteEmail(id, body.data, partner, new URL(req.url).origin));
  } catch (err) {
    // Email problems (not set up, unverified domain, service down) have
    // messages meant for staff; anything else stays generic.
    if (err instanceof EmailError) return NextResponse.json({ error: err.message }, { status: err.status });
    return financeErrorResponse(err, 'send quote');
  }
});
