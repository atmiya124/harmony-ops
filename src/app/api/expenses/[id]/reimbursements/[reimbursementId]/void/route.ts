import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { voidReimbursement } from '@/lib/db/financeRepo';
import { voidInputSchema } from '@/lib/schemas/finance';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string; reimbursementId: string }>;
}

// Voids a mistaken reimbursement. Nothing is deleted: the payment stays in
// the history with who voided it and why, it just stops counting.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id, reimbursementId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(reimbursementId).success) {
    return NextResponse.json({ error: 'Reimbursement not found' }, { status: 404 });
  }
  const body = parseBody(voidInputSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await voidReimbursement(id, reimbursementId, body.data.reason, partner));
  } catch (err) {
    return financeErrorResponse(err, 'void reimbursement');
  }
});
