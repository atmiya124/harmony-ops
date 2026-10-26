import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { recordLabourPayments } from '@/lib/db/labourRepo';
import { labourBatchPaymentSchema } from '@/lib/schemas/finance';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

// "Pay all": pays several crew lines in full at once, all or nothing.
export const POST = withPartner(async (req, { partner }) => {
  const body = parseBody(labourBatchPaymentSchema(todayInFinanceTz()), await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await recordLabourPayments(body.data, partner), { status: 201 });
  } catch (err) {
    return financeErrorResponse(err, 'record crew payments');
  }
});
