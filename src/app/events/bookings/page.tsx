'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Calendar } from 'lucide-react';
import { BookingStatus } from '@/lib/bookingTypes';
import UpcomingTimeline from '@/components/booking/UpcomingTimeline';
import ErrorState from '@/components/ui/ErrorState';
import { useBookings } from '@/hooks/useBookings';

type FilterTab = 'All' | 'Upcoming' | BookingStatus;
const FILTERS: FilterTab[] = ['All', 'Upcoming', 'Tentative', 'Confirmed', 'Completed', 'Cancelled'];

function daysUntil(dateStr: string): number {
  if (!dateStr) return -9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${dateStr}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

export default function BookingsListPage() {
  const { bookings, loading, error } = useBookings();
  const [tab, setTab] = useState<FilterTab>('Upcoming');

  const filtered = useMemo(() => {
    return bookings
      .filter((b) => {
        if (tab === 'All') return true;
        if (tab === 'Upcoming') return daysUntil(b.eventDate) >= 0 && (b.status === 'Confirmed' || b.status === 'Tentative');
        return b.status === tab;
      })
      .sort((a, b) => (a.eventDate || '9999-99-99').localeCompare(b.eventDate || '9999-99-99'));
  }, [bookings, tab]);

  return (
    <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-white">Upcoming events</p>
          <p className="mt-0.5 text-xs text-[var(--flat-text-faint)]">{bookings.length} total bookings</p>
        </div>
        <Link href="/events/bookings/new" className="flex items-center gap-1.5 rounded-lg bg-[var(--neon-mint)] px-3 py-2 text-xs font-bold text-[#0a0a0a]">
          <Plus size={15} /> New
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTab(f)}
            className={`rounded-full border px-2.5 py-1.5 text-[11px] ${
              tab === f ? 'border-white bg-white font-bold text-[#0a0a0a]' : 'border-[var(--flat-border)] bg-[var(--flat-surface-input)] text-[var(--flat-text-faint)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-[var(--flat-text-ghost)]">Loading…</p>
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Calendar size={32} className="text-[var(--flat-text-ghost)]" />
          <p className="text-sm font-bold text-[var(--flat-text-dim)]">No {tab === 'All' ? '' : tab.toLowerCase()} bookings</p>
          <p className="max-w-xs text-xs text-[var(--flat-text-faint)]">Tap &ldquo;New&rdquo; to create one, or paste a client email to pre-fill it</p>
        </div>
      ) : (
        <UpcomingTimeline bookings={filtered} highlightFirst={false} />
      )}
    </div>
  );
}
