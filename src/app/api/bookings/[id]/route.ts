import { NextRequest, NextResponse } from 'next/server';
import { deleteBooking, getBookingById, updateBooking } from '@/lib/db/bookingRepo';
import { bookingInputSchema } from '@/lib/schemas/booking';
import { formatZodError } from '@/lib/schemas/formatZodError';
import { withPartner } from '@/lib/auth/session';

interface Params {
  params: Promise<{ id: string }>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

async function handleGET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const booking = await getBookingById(Number(id));
    if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(booking);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

async function handlePATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const json = await req.json().catch(() => null);
    const result = bookingInputSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 });
    }
    // id/createdAt/updatedAt are server-assigned — updateBooking never
    // reads them from the input, these placeholders just satisfy the type.
    const updated = await updateBooking(Number(id), { ...result.data, id: Number(id), createdAt: '', updatedAt: '' });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

async function handleDELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await deleteBooking(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export const GET = withPartner(handleGET);
export const PATCH = withPartner(handlePATCH);
export const DELETE = withPartner(handleDELETE);
