import { NextRequest, NextResponse } from 'next/server';
import { createBooking, listBookings } from '@/lib/db/bookingRepo';
import { Booking } from '@/lib/bookingTypes';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

export async function GET() {
  try {
    const bookings = await listBookings();
    return NextResponse.json(bookings);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Booking;
    if (!body?.eventTitle && !body?.clientName) {
      return NextResponse.json({ error: 'Missing booking data' }, { status: 400 });
    }
    const created = await createBooking(body);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
