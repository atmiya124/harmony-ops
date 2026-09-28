'use client';

import { useCachedData } from './useCachedData';
import { BOOKINGS_KEY, listBookings } from '@/lib/bookingsApi';

// All bookings. Shows the last list seen straight away on a return visit and
// refreshes it in the background.
export function useBookings() {
  const { data, loading, error } = useCachedData(BOOKINGS_KEY, listBookings);
  return { bookings: data ?? [], loading, error };
}
