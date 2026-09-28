import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { restoreExpense } from '@/lib/db/financeRepo';
import { financeErrorResponse } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

// Undo for a deleted expense (e.g. the "Undo" after an accidental save).
export const POST = withPartner<Request, Params>(async (_req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  try {
    return NextResponse.json(await restoreExpense(id, partner));
  } catch (err) {
    return financeErrorResponse(err, 'restore expense');
  }
});
