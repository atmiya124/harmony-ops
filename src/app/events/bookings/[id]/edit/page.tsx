'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NewBookingForm from '@/components/booking/NewBookingForm';
import { Booking } from '@/lib/bookingTypes';
import { getBooking, updateBooking } from '@/lib/bookingsApi';
import ErrorState from '@/components/ui/ErrorState';
import Screen from '@/components/navigation/Screen';

function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getBooking(id)
      .then((b) => (b ? setBooking(b) : setError('Booking not found.')))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load booking.'));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!booking) return <p className="py-20 text-center text-sm text-[var(--flat-text-ghost)]">Loading…</p>;

  return (
    <div>
      {saveError && (
        <p className="mb-3 rounded-lg border border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.08)] px-3 py-2 text-xs text-[var(--neon-pink)]">
          {saveError}
        </p>
      )}
      <NewBookingForm
        initial={booking}
        isEdit
        onCancel={() => router.push(`/events/bookings/${id}`)}
        onSave={async (updated) => {
          setSaveError(null);
          try {
            await updateBooking(updated);
            router.push(`/events/bookings/${id}`);
          } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save booking.');
          }
        }}
      />
    </div>
  );
}

// Animated like a native screen push/pop (see components/navigation).
export default function Page(props: React.ComponentProps<typeof EditBookingPage>) {
  return (
    <Screen title="Edit booking" back>
      <EditBookingPage {...props} />
    </Screen>
  );
}
