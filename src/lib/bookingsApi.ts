import { Booking } from './bookingTypes';
import { invalidateCache, setCache, updateCache } from './clientCache';

// Cache keys: the full list, and each booking by id. Reads refresh them;
// saves and deletes update them at once so no screen shows the old version.
export const BOOKINGS_KEY = 'bookings';
export const bookingKey = (id: number | string) => `booking:${id}`;

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
  const bookings: Booking[] = await res.json();
  for (const b of bookings) setCache(bookingKey(b.id), b);
  return bookings;
}

export async function getBooking(id: number | string): Promise<Booking | null> {
  const res = await fetch(`/api/bookings/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await extractError(res, 'Failed to load booking'));
  const booking: Booking = await res.json();
  setCache(bookingKey(booking.id), booking);
  return booking;
}

export async function createBooking(booking: Booking): Promise<Booking> {
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(booking),
  });
  if (!res.ok) throw new Error(await extractError(res, 'Failed to create booking'));
  const created: Booking = await res.json();
  setCache(bookingKey(created.id), created);
  updateCache<Booking[]>(BOOKINGS_KEY, (list) => [...list, created]);
  return created;
}

export async function updateBooking(booking: Booking): Promise<Booking> {
  const res = await fetch(`/api/bookings/${booking.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(booking),
  });
  if (!res.ok) throw new Error(await extractError(res, 'Failed to update booking'));
  const updated: Booking = await res.json();
  setCache(bookingKey(updated.id), updated);
  updateCache<Booking[]>(BOOKINGS_KEY, (list) => list.map((b) => (b.id === updated.id ? updated : b)));
  return updated;
}

// Reused by both the manual 5-step form and the AI review screen so there
// is exactly one save path.
export async function saveBooking(booking: Booking, isEdit: boolean): Promise<Booking> {
  return isEdit ? updateBooking(booking) : createBooking(booking);
}

export async function deleteBooking(id: number | string): Promise<void> {
  const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await extractError(res, 'Failed to delete booking'));
  invalidateCache(bookingKey(id));
  updateCache<Booking[]>(BOOKINGS_KEY, (list) => list.filter((b) => String(b.id) !== String(id)));
}
