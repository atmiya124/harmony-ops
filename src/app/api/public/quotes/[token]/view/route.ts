import { NextResponse } from 'next/server';
import { recordClientView } from '@/lib/db/clientLinkRepo';
import { getPartnerFromHeaders } from '@/lib/auth/session';
import { financeErrorResponse } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ token: string }>;
}

// Public: the client's page reports that it was opened (sent from the
// browser, so link previews in chat and email apps don't count as views). A
// signed-in partner checking the link isn't counted either.
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  try {
    const partner = await getPartnerFromHeaders(req.headers).catch(() => null);
    if (partner) return new NextResponse(null, { status: 204 });
    const ok = await recordClientView(token);
    return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: 'This quote link isn’t valid.' }, { status: 404 });
  } catch (err) {
    return financeErrorResponse(err, 'record quote view');
  }
}
