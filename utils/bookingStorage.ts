import AsyncStorage from '@react-native-async-storage/async-storage';
import { Booking } from './bookingTypes';

const STORAGE_KEY = '@hp_bookings';

export async function listBookings(): Promise<Booking[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Booking[];
  } catch {
    return [];
  }
}

async function persist(bookings: Booking[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

export async function getBooking(id: string): Promise<Booking | undefined> {
  const bookings = await listBookings();
  return bookings.find((b) => b.id === id);
}

export async function saveBooking(booking: Booking): Promise<void> {
  const bookings = await listBookings();
  const index = bookings.findIndex((b) => b.id === booking.id);
  const updated = { ...booking, updatedAt: Date.now() };
  if (index >= 0) {
    bookings[index] = updated;
  } else {
    bookings.unshift(updated);
  }
  await persist(bookings);
}

export async function deleteBooking(id: string): Promise<void> {
  const bookings = await listBookings();
  await persist(bookings.filter((b) => b.id !== id));
}
