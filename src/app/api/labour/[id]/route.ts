import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { getLabour } from '@/lib/db/labourRepo';
import { financeErrorResponse } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

const notFound = () => NextResponse.json({ error: 'Labour not found' }, { status: 404 });

// One labour record (by its expense id): each person's hours, earned, paid.
export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  try {
    const labour = await getLabour(id);
    return labour ? NextResponse.json(labour) : notFound();
  } catch (err) {
    return financeErrorResponse(err, 'load labour');
  }
});
