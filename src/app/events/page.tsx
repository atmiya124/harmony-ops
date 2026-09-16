'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Mail, MapPin, Phone, Plus, Bell } from 'lucide-react';
import { Booking, BookingStatus } from '@/lib/bookingTypes';
import UpcomingTimeline from '@/components/booking/UpcomingTimeline';
import StatusBadge, { statusColor } from '@/components/booking/StatusBadge';
import ActionLink from '@/components/booking/ActionLink';
import ErrorState from '@/components/ui/ErrorState';
import { useBookings } from '@/hooks/useBookings';
import { buildReminderMailto, getPartnerSettings } from '@/lib/partnerApi';
import { colorAlpha } from '@/lib/colorAlpha';

function daysUntil(dateStr: string): number {
  if (!dateStr) return -9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${dateStr}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function daysAwayLabel(n: number): string {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDayDate(dateStr: string): string {
  if (!dateStr) return 'No date set';
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

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

export default function EventsHomePage() {
  const { bookings, loading, error } = useBookings();
  const [partnerEmails, setPartnerEmails] = useState<string[]>([]);

  useEffect(() => {
    getPartnerSettings()
      .then((s) => setPartnerEmails(s.partnerEmails))
      .catch(() => {});
  }, []);

  const nextEvent = useMemo(
    () =>
      [...bookings]
        .filter((b) => b.eventDate && daysUntil(b.eventDate) >= 0 && b.status !== 'Cancelled')
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0],
    [bookings],
  );

  const thisMonthUpcoming = useMemo(() => {
    const today = new Date();
    const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = today.toISOString().slice(0, 10);
    return bookings
      .filter((b) => b.status !== 'Completed' && b.eventDate.startsWith(monthPrefix) && b.eventDate >= todayStr)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [bookings]);

  const counts = useMemo(() => {
    const c: Record<BookingStatus, number> = { Tentative: 0, Confirmed: 0, Completed: 0, Cancelled: 0 };
    for (const b of bookings) c[b.status] += 1;
    return c;
  }, [bookings]);

  if (loading) return <p className="py-20 text-center text-sm text-[var(--flat-text-ghost)]">Loading…</p>;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xl font-bold text-white">{greeting()}</p>
        <p className="mt-0.5 text-xs text-[var(--flat-text-faint)]">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(counts) as BookingStatus[]).map((status) => (
          <div key={status} className="flex flex-col items-center rounded-lg border bg-[var(--flat-surface)] py-2.5" style={{ borderColor: colorAlpha(statusColor[status], 30) }}>
            <span className="text-lg font-bold" style={{ color: statusColor[status] }}>
              {counts[status]}
            </span>
            <span className="mt-0.5 text-[10px] text-[var(--flat-text-faint)]">{status}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-bold text-white">Next up</p>
          <Link href="/events/bookings/new" className="flex items-center gap-1.5 rounded-lg bg-[var(--neon-mint)] px-3 py-2 text-xs font-bold text-[#0a0a0a]">
            <Plus size={15} /> New
          </Link>
        </div>

        {nextEvent ? (
          <div className="rounded-xl border border-[rgba(0,212,255,0.3)] bg-[rgba(0,212,255,0.05)] p-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <StatusBadge status={nextEvent.status} />
              <span className="text-[11px] font-bold text-[var(--neon-cyan)]">
                {daysAwayLabel(daysUntil(nextEvent.eventDate))} · {nextEvent.eventDate}
              </span>
            </div>

            <Link href={`/events/bookings/${nextEvent.id}`} className="block">
              <p className="text-lg font-bold text-white">{nextEvent.eventTitle || 'Untitled event'}</p>
            </Link>

            <div className="mt-3 space-y-2">
              <Row icon={Calendar} color="var(--neon-cyan)" text={formatDayDate(nextEvent.eventDate)} />
              <Row
                icon={Clock}
                color="var(--neon-purple)"
                text={`Setup ${to12hr(nextEvent.setupTime)} · Start ${to12hr(nextEvent.startTime)} · End ${to12hr(nextEvent.endTime)}`}
              />
              <Row icon={MapPin} color="var(--neon-pink)" text={nextEvent.venueName || 'No venue set'} sub={nextEvent.venueAddress || undefined} />
            </div>

            <div className="mt-4 flex gap-2">
              <ActionLink icon={Phone} label="Call" color="var(--neon-green)" href={nextEvent.clientPhone ? `tel:${nextEvent.clientPhone}` : undefined} />
              <ActionLink
                icon={MapPin}
                label="Maps"
                color="var(--neon-cyan)"
                href={nextEvent.venueAddress ? `https://maps.google.com/?q=${encodeURIComponent(nextEvent.venueAddress)}` : undefined}
              />
              <ActionLink icon={Mail} label="Email" color="var(--neon-purple)" href={nextEvent.clientEmail ? `mailto:${nextEvent.clientEmail}` : undefined} />
              <ActionLink
                icon={Bell}
                label="Remind"
                color="var(--neon-orange)"
                href={partnerEmails.length > 0 ? buildReminderMailto(nextEvent, partnerEmails) : undefined}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-5 text-center">
            <Calendar size={24} className="text-[var(--flat-text-ghost)]" />
            <p className="text-xs text-[var(--flat-text-faint)]">No upcoming bookings</p>
          </div>
        )}
      </div>

      {thisMonthUpcoming.length > 0 && (
        <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base font-bold text-white">Upcoming this month</p>
            <Link href="/events/bookings" className="text-xs text-[var(--neon-cyan)]">
              View all
            </Link>
          </div>
          <UpcomingTimeline bookings={thisMonthUpcoming} highlightFirst={false} />
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, color, text, sub }: { icon: typeof Calendar; color: string; text: string; sub?: string }) {
  if (!text) return null;
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: colorAlpha(color, 18) }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-white">{text}</p>
        {sub ? <p className="mt-0.5 text-[11px] text-[var(--flat-text-faint)]">{sub}</p> : null}
      </div>
    </div>
  );
}
