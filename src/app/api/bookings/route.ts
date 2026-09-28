import { NextRequest, NextResponse } from 'next/server';
import { createBooking, listBookings } from '@/lib/db/bookingRepo';
import { bookingInputSchema } from '@/lib/schemas/booking';
import { formatZodError } from '@/lib/schemas/formatZodError';
import { withPartner } from '@/lib/auth/session';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

async function handleGET() {
  try {
    const bookings = await listBookings();
    return NextResponse.json(bookings);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const result = bookingInputSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 });
    }
    if (!result.data.eventTitle && !result.data.clientName) {
      return NextResponse.json({ error: 'Missing booking data' }, { status: 400 });
    }
    // id/createdAt/updatedAt are server-assigned — createBooking never
    // reads them from the input, these placeholders just satisfy the type.
    const created = await createBooking({ ...result.data, id: 0, createdAt: '', updatedAt: '' });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export const GET = withPartner(handleGET);
export const POST = withPartner(handlePOST);
