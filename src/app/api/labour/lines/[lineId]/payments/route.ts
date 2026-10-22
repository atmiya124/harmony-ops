import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { recordLabourPayment } from '@/lib/db/labourRepo';
import { labourPaymentSchema } from '@/lib/schemas/finance';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ lineId: string }>;
}

// Records a payment to one crew person. Returns the updated labour.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { lineId } = await params;
  if (!z.uuid().safeParse(lineId).success) return NextResponse.json({ error: 'Crew hours not found' }, { status: 404 });
  const body = parseBody(labourPaymentSchema(todayInFinanceTz()), await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await recordLabourPayment(lineId, body.data, partner), { status: 201 });
  } catch (err) {
    return financeErrorResponse(err, 'record crew payment');
  }
});
