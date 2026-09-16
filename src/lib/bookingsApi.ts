import { Booking } from './bookingTypes';

async function extractError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.error || fallback;
  } catch {
    return fallback;
  }
}

export async function listBookings(): Promise<Booking[]> {
  const res = await fetch('/api/bookings');
  if (!res.ok) throw new Error(await extractError(res, 'Failed to load bookings'));
  return res.json();
}

export async function getBooking(id: number | string): Promise<Booking | null> {
  const res = await fetch(`/api/bookings/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await extractError(res, 'Failed to load booking'));
  return res.json();
}

export async function createBooking(booking: Booking): Promise<Booking> {
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(booking),
  });
  if (!res.ok) throw new Error(await extractError(res, 'Failed to create booking'));
  return res.json();
}

export async function updateBooking(booking: Booking): Promise<Booking> {
  const res = await fetch(`/api/bookings/${booking.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(booking),
  });
  if (!res.ok) throw new Error(await extractError(res, 'Failed to update booking'));
  return res.json();
}

// Reused by both the manual 5-step form and the AI review screen so there
// is exactly one save path.
export async function saveBooking(booking: Booking, isEdit: boolean): Promise<Booking> {
  return isEdit ? updateBooking(booking) : createBooking(booking);
}

export async function deleteBooking(id: number | string): Promise<void> {
  const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await extractError(res, 'Failed to delete booking'));
}
