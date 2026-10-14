import { NextResponse } from 'next/server';
import { getPublicQuote } from '@/lib/db/clientLinkRepo';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ token: string }>;
}

const INVALID_LINK = 'This quote link isn’t valid. Please contact Harmony Production for a new link.';

// Public: the quote behind a client link, as the client may see it. No
// session needed — the token is the access. Invalid, revoked and expired
// links all get the same 404.
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  try {
    const quote = await getPublicQuote(token, todayInFinanceTz());
    if (!quote) return NextResponse.json({ error: INVALID_LINK }, { status: 404 });
    return NextResponse.json(quote);
  } catch (err) {
    return financeErrorResponse(err, 'public quote');
  }
}
