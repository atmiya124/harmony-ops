import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { addReimbursement } from '@/lib/db/financeRepo';
import { reimbursementInputSchema } from '@/lib/schemas/finance';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

// Records money paid back to the partner — the full amount or part of it.
// Returns the updated expense with its new outstanding balance.
export const POST = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  const body = parseBody(reimbursementInputSchema(todayInFinanceTz()), await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await addReimbursement(id, body.data, partner), { status: 201 });
  } catch (err) {
    return financeErrorResponse(err, 'record reimbursement');
  }
});
