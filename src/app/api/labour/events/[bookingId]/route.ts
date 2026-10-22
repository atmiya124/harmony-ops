import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { getEventLabour, saveEventLabour } from '@/lib/db/labourRepo';
import { labourSaveSchema } from '@/lib/schemas/finance';
import { todayInFinanceTz } from '@/lib/finance/today';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ bookingId: string }>;
}

const bookingIdSchema = z.coerce.number().int().positive();
const notFound = () => NextResponse.json({ error: 'Event not found' }, { status: 404 });

// An event's crew labour (null when none has been entered yet).
export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const id = bookingIdSchema.safeParse((await params).bookingId);
  if (!id.success) return notFound();
  try {
    return NextResponse.json(await getEventLabour(id.data));
  } catch (err) {
    return financeErrorResponse(err, 'load labour');
  }
});

// Saves the event's crew hours (creates its labour on first save).
export const PUT = withPartner<Request, Params>(async (req, { params, partner }) => {
  const id = bookingIdSchema.safeParse((await params).bookingId);
  if (!id.success) return notFound();
  const body = parseBody(labourSaveSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await saveEventLabour(id.data, body.data, partner, todayInFinanceTz()));
  } catch (err) {
    return financeErrorResponse(err, 'save labour');
  }
});
