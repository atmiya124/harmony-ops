import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { createExpense, listExpenses } from '@/lib/db/financeRepo';
import { expenseInputSchema, isCalendarDate } from '@/lib/schemas/finance';
import { EXPENSE_CATEGORIES } from '@/lib/finance/types';
import { todayInFinanceTz } from '@/lib/finance/today';
import { badRequest, financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

// Query-string filters for the expense list / dashboard.
const listQuerySchema = z.object({
  from: z.string().refine(isCalendarDate, 'from must be YYYY-MM-DD').optional(),
  to: z.string().refine(isCalendarDate, 'to must be YYYY-MM-DD').optional(),
  // A booking id, or "general" for expenses not tied to an event.
  event: z.union([z.literal('general'), z.coerce.number().int().positive()]).optional(),
  paidBy: z.string().trim().toLowerCase().pipe(z.email()).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  includeDeleted: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

export const GET = withPartner(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = listQuerySchema.safeParse(params);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid filter');
  const q = parsed.data;
  try {
    const expenses = await listExpenses({
      from: q.from,
      to: q.to,
      bookingId: q.event,
      paidByEmail: q.paidBy,
      category: q.category,
      includeDeleted: q.includeDeleted === 'true',
      limit: q.limit,
    });
    return NextResponse.json(expenses);
  } catch (err) {
    return financeErrorResponse(err, 'list expenses');
  }
});

export const POST = withPartner(async (req, { partner }) => {
  const body = parseBody(expenseInputSchema(todayInFinanceTz()), await readJson(req));
  if (!body.ok) return body.response;
  try {
    const { expense, created } = await createExpense(body.data, partner);
    return NextResponse.json(expense, { status: created ? 201 : 200 });
  } catch (err) {
    return financeErrorResponse(err, 'create expense');
  }
});
