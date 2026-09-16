'use client';

import { useEffect, useState } from 'react';
import { Booking } from '@/lib/bookingTypes';
import { listBookings } from '@/lib/bookingsApi';

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listBookings()
      .then((data) => {
        if (cancelled) return;
        setBookings(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load bookings.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { bookings, loading, error };
}
