import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { getQuote } from '@/lib/db/quoteRepo';
import { bookAcceptedQuote } from '@/lib/db/quoteBooking';
import { financeErrorResponse } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

// Recovery for a client acceptance whose automatic booking didn't happen:
// the same booking logic, so it's safe to repeat (it never makes a second
// booking). Refused unless the client accepted through their link.
export const POST = withPartner<Request, Params>(async (_req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  try {
    const booked = await bookAcceptedQuote(id, { userId: partner.id, email: partner.email });
    if (!booked) {
      return NextResponse.json({ error: 'A booking is only created from a quote the client accepted through their link.' }, { status: 409 });
    }
    return NextResponse.json(await getQuote(id));
  } catch (err) {
    return financeErrorResponse(err, 'create booking from quote');
  }
});
