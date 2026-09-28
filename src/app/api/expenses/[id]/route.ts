import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { deleteExpense, getExpenseDetail, updateExpense } from '@/lib/db/financeRepo';
import { expenseUpdateSchema } from '@/lib/schemas/finance';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

const idSchema = z.uuid();

async function expenseId(params: Params['params']): Promise<string | null> {
  const { id } = await params;
  return idSchema.safeParse(id).success ? id : null;
}

const notFound = () => NextResponse.json({ error: 'Expense not found' }, { status: 404 });

// Full record with its reimbursement payments and change history.
export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const id = await expenseId(params);
  if (!id) return notFound();
  try {
    const expense = await getExpenseDetail(id);
    return expense ? NextResponse.json(expense) : notFound();
  } catch (err) {
    return financeErrorResponse(err, 'load expense');
  }
});

export const PATCH = withPartner<Request, Params>(async (req, { params, partner }) => {
  const id = await expenseId(params);
  if (!id) return notFound();
  const body = parseBody(expenseUpdateSchema(todayInFinanceTz()), await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await updateExpense(id, body.data, partner));
  } catch (err) {
    return financeErrorResponse(err, 'update expense');
  }
});

// Soft delete — restorable via POST /api/expenses/[id]/restore.
export const DELETE = withPartner<Request, Params>(async (_req, { params, partner }) => {
  const id = await expenseId(params);
  if (!id) return notFound();
  try {
    return NextResponse.json(await deleteExpense(id, partner));
  } catch (err) {
    return financeErrorResponse(err, 'delete expense');
  }
});
