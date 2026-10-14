import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { getPartnerSummary } from '@/lib/db/financeRepo';
import { financeErrorResponse } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ email: string }>;
}

// One partner's spending, what they're owed and their payment history.
export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const { email } = await params;
  try {
    const summary = await getPartnerSummary(decodeURIComponent(email));
    return summary ? NextResponse.json(summary) : NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  } catch (err) {
    return financeErrorResponse(err, 'load partner');
  }
});
