import { NextRequest, NextResponse } from 'next/server';
import { deleteBooking, getBookingById, updateBooking } from '@/lib/db/bookingRepo';
import { Booking } from '@/lib/bookingTypes';

interface Params {
  params: Promise<{ id: string }>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const booking = await getBookingById(Number(id));
    if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(booking);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Booking;
    const updated = await updateBooking(Number(id), body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await deleteBooking(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
