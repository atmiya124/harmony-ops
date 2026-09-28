'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Plus } from 'lucide-react';
import { Booking, BookingStatus } from '@/lib/bookingTypes';
import { statusColor } from '@/components/booking/StatusBadge';
import ErrorState from '@/components/ui/ErrorState';
import { useBookings } from '@/hooks/useBookings';
import Screen from '@/components/navigation/Screen';
import CardGlow from '@/components/ui/CardGlow';

type FilterTab = 'All' | 'Upcoming' | BookingStatus;
const FILTERS: FilterTab[] = ['All', 'Upcoming', 'Tentative', 'Confirmed', 'Completed', 'Cancelled'];

function daysUntil(dateStr: string): number {
  if (!dateStr) return -9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${dateStr}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function isUpcoming(b: Booking): boolean {
  return daysUntil(b.eventDate) >= 0 && (b.status === 'Confirmed' || b.status === 'Tentative');
}

function whenLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function to12hr(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return time;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// "5:00 – 11:00 PM" (one meridiem when both times share it).
function timeRange(start: string, end: string): string {
  const s = to12hr(start);
  const e = to12hr(end);
  if (!s) return e;
  if (!e) return s;
  const [sTime, sMer] = s.split(' ');
  const [, eMer] = e.split(' ');
  return sMer === eMer ? `${sTime} – ${e}` : `${s} – ${e}`;
}

function dateParts(iso: string) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    long: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  };
}

function BookingsListPage() {
  const { bookings, loading, error } = useBookings();
  const [tab, setTab] = useState<FilterTab>('Upcoming');

  const nextEvent = useMemo(
    () => bookings.filter(isUpcoming).sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0],
    [bookings],
  );

  const filtered = useMemo(() => {
    return bookings
      .filter((b) => {
        if (tab === 'All') return true;
        if (tab === 'Upcoming') return isUpcoming(b) && b.id !== nextEvent?.id; // the hero already shows the next one
        return b.status === tab;
      })
      .sort((a, b) => (a.eventDate || '9999-99-99').localeCompare(b.eventDate || '9999-99-99'));
  }, [bookings, tab, nextEvent]);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="h-[184px] animate-pulse rounded-[28px] bg-white/[0.03]" />
      ) : nextEvent ? (
        <NextEventHero booking={nextEvent} />
      ) : null}

      <div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filter bookings">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={tab === f}
              onClick={() => setTab(f)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 transition ${tab === f ? 'bg-white/[0.12] text-white' : 'text-white/45 hover:text-white/70'}`}
            >
              <span className="text-[13px] font-semibold">{f}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-2 space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Calendar size={28} className="text-white/20" />
            <p className="text-[15px] font-semibold text-white/70">
              {tab === 'Upcoming' && nextEvent ? 'Nothing else coming up' : `No ${tab === 'All' ? '' : tab.toLowerCase() + ' '}bookings`}
            </p>
            <p className="max-w-xs text-[13px] leading-relaxed text-white/40">Tap + to add a booking, or paste a client email to pre-fill it.</p>
          </div>
        ) : (
          <ul className="mt-1">
            {filtered.map((b) => (
              <EventRow key={b.id} booking={b} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// The next upcoming event, with a soft blue glow rising from the bottom edge.
function NextEventHero({ booking }: { booking: Booking }) {
  const parts = dateParts(booking.eventDate);
  const time = timeRange(booking.startTime, booking.endTime);
  const place = [booking.venueName, booking.venueAddress?.split(',').slice(-1)[0]?.trim()].filter(Boolean).join(', ');
  return (
    <Link
      href={`/events/bookings/${booking.id}`}
      className="relative block overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0f16] px-5 pb-6 pt-5"
    >
      <CardGlow />
      <div className="relative">
        <p className="flex items-center gap-2 text-[13px] font-medium text-white/60">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: statusColor[booking.status] }} />
          Next event · {booking.status} · {whenLabel(daysUntil(booking.eventDate))}
        </p>
        <p className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-tight text-white">{booking.eventTitle || 'Untitled event'}</p>
        <p className="mt-2.5 text-[15px] text-white/75">{[parts?.long, time].filter(Boolean).join(' · ')}</p>
        {place ? <p className="mt-0.5 text-[15px] text-white/45">{place}</p> : null}
      </div>
    </Link>
  );
}

// Title and details on the left; a bold date "stamp" on the right.
function EventRow({ booking }: { booking: Booking }) {
  const parts = dateParts(booking.eventDate);
  const time = timeRange(booking.startTime, booking.endTime);
  const who = [booking.clientName, booking.venueName].filter(Boolean).join(' · ');
  return (
    <li className="border-b border-white/[0.07] last:border-b-0">
      <Link href={`/events/bookings/${booking.id}`} className="flex items-center gap-4 py-4">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor[booking.status] }} aria-label={booking.status} />
            <span className="truncate text-[17px] font-semibold text-white">{booking.eventTitle || 'Untitled event'}</span>
          </span>
          {who ? <span className="mt-1 block truncate pl-3.5 text-[14px] text-white/55">{who}</span> : null}
          <span className="mt-0.5 block truncate pl-3.5 text-[13px] text-white/35">
            {[booking.status !== 'Confirmed' ? booking.status : '', time].filter(Boolean).join(' · ')}
          </span>
        </span>
        {parts ? (
          <span className="flex w-14 shrink-0 flex-col items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] py-2">
            <span className="text-[11px] font-bold tracking-[0.12em] text-[#8fa8ff]">{parts.month}</span>
            <span className="text-[24px] font-bold leading-tight tabular-nums text-white">{parts.day}</span>
            <span className="text-[11px] text-white/40">{parts.weekday}</span>
          </span>
        ) : (
          <span className="w-14 shrink-0 text-center text-[11px] text-white/35">No date</span>
        )}
      </Link>
    </li>
  );
}

// Animated like a native screen push/pop (see components/navigation).
export default function Page() {
  return (
    <Screen
      title="Bookings"
      section="bookings"
      action={
        <Link
          href="/events/bookings/new"
          aria-label="New booking"
          className="flex size-11 items-center justify-center rounded-full bg-white text-[#0a0a0a] shadow-lg shadow-black/40"
        >
          <Plus size={22} strokeWidth={2.5} />
        </Link>
      }
    >
      <BookingsListPage />
    </Screen>
  );
}
