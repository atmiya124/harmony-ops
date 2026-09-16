'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CalendarClock, ChevronRight, Clock3, MapPin, Truck } from 'lucide-react';
import { initialEvents } from '@/lib/harmony-data';

export default function TodayPage() {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todaysEvents = useMemo(
    () => initialEvents.filter((event) => event.eventDate === todayStr),
    [todayStr],
  );

  const upcoming = useMemo(
    () =>
      [...initialEvents]
        .filter((event) => event.eventDate >= todayStr)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
        .slice(0, 5),
    [todayStr],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div className="rounded-[28px] border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Today</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Operations board</h2>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
            <CalendarClock className="size-6" />
          </div>
        </div>

        {todaysEvents.length === 0 ? (
          <div className="rounded-[24px] border border-slate-700 bg-slate-950/50 p-5 text-slate-300">
            <p className="text-lg font-semibold text-white">No scheduled events today.</p>
            <p className="mt-2">The daily operations view shows active setups, pickup windows, and reminders here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todaysEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/bookings/${event.id}`}
                className="block rounded-[24px] border border-slate-700 bg-slate-950/50 p-5 transition hover:border-amber-400/50"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-lg font-semibold text-white">{event.title}</p>
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-200">{event.status}</span>
                </div>
                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-4 text-amber-300" />
                    Setup {event.setupTime} &middot; Live {event.startTime}&ndash;{event.endTime}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-amber-300" />
                    {event.venueName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-amber-300" />
                    {event.pickupDetail}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="rounded-[28px] border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
          <p className="mb-4 text-xs uppercase tracking-[0.28em] text-slate-400">Coming up</p>
          <div className="space-y-2">
            {upcoming.map((event) => (
              <Link
                key={event.id}
                href={`/events/bookings/${event.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/40 p-3.5 transition hover:border-slate-500"
              >
                <div>
                  <p className="font-medium text-white">{event.title}</p>
                  <p className="text-xs text-slate-400">{event.eventDate} &middot; {event.venueName}</p>
                </div>
                <ChevronRight className="size-4 text-slate-500" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
