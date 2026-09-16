'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CalendarCheck2, ChevronRight, MapPin, Truck, Clock as ClockIcon } from 'lucide-react';
import StatusBadge from '@/components/booking/StatusBadge';
import ErrorState from '@/components/ui/ErrorState';
import { useBookings } from '@/hooks/useBookings';

function to12hr(time: string): string {
  if (!time) return '—';
  try {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return time;
  }
}

export default function TodayPage() {
  const { bookings, loading, error } = useBookings();
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todays = useMemo(() => bookings.filter((b) => b.eventDate === todayStr), [bookings, todayStr]);
  const upcoming = useMemo(
    () =>
      [...bookings]
        .filter((b) => b.eventDate && b.eventDate > todayStr)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
        .slice(0, 5),
    [bookings, todayStr],
  );

  if (loading) return <p className="py-20 text-center text-sm text-[var(--flat-text-ghost)]">Loading…</p>;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-bold text-white">Operations board</p>
          <span className="flex items-center gap-1.5 rounded-full bg-[rgba(251,146,60,0.15)] px-2.5 py-1 text-[11px] font-bold text-[var(--neon-orange)]">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {todays.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
            <CalendarCheck2 size={26} className="text-[var(--flat-text-ghost)]" />
            <p className="text-[13px] font-bold text-[var(--flat-text-dim)]">No scheduled events today</p>
            <p className="max-w-xs px-4 text-[11px] text-[var(--flat-text-faint)]">Active setups, pickup windows, and reminders will show up here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {todays.map((event) => (
              <Link key={event.id} href={`/events/bookings/${event.id}`} className="block rounded-xl border border-[rgba(251,146,60,0.3)] bg-[var(--flat-surface-alt)] p-3.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-white">{event.eventTitle || 'Untitled event'}</p>
                  <StatusBadge status={event.status} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--flat-text-dim)]">
                  <ClockIcon size={13} className="text-[var(--neon-orange)]" />
                  Start {to12hr(event.startTime)} – End {to12hr(event.endTime)}
                </div>
                {event.venueName ? (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--flat-text-dim)]">
                    <MapPin size={13} className="text-[var(--neon-orange)]" />
                    {event.venueName}
                  </div>
                ) : null}
                {Boolean(event.pickupDate || event.pickupTime) && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--flat-text-dim)]">
                    <Truck size={13} className="text-[var(--neon-orange)]" />
                    Pickup {event.pickupDate} {to12hr(event.pickupTime)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
          <p className="mb-3 text-base font-bold text-white">Coming up</p>
          <div className="space-y-2">
            {upcoming.map((event) => (
              <Link key={event.id} href={`/events/bookings/${event.id}`} className="flex items-center gap-2 rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-white">{event.eventTitle || 'Untitled event'}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--flat-text-faint)]">
                    {event.eventDate} · {event.venueName || 'No venue'}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-[var(--flat-text-faint)]" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
