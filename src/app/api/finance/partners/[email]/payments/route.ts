import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { recordPartnerPayment } from '@/lib/db/financeRepo';
import { reimbursementInputSchema } from '@/lib/schemas/finance';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ email: string }>;
}

// Records money paid back to a partner, applied to their oldest outstanding
// expenses first. Returns the partner's updated summary.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { email } = await params;
  const body = parseBody(reimbursementInputSchema(todayInFinanceTz()), await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await recordPartnerPayment(decodeURIComponent(email), body.data, partner), { status: 201 });
  } catch (err) {
    return financeErrorResponse(err, 'record partner payment');
  }
});
