'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { initialEvents } from '@/lib/harmony-data';

export default function EventsHomePage() {
  const [events] = useState(initialEvents);

  const nextEvent = useMemo(
    () => [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0],
    [events],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="rounded-[28px] border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">Events</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Upcoming events</h2>
          </div>
          <Link
            href="/events/bookings/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            <Plus className="size-4" />
            New booking
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/bookings/${event.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/50 p-4 transition hover:border-slate-500"
              >
                <div>
                  <p className="text-lg font-semibold text-white">{event.title}</p>
                  <p className="text-sm text-slate-400">{event.eventDate} · {event.eventType}</p>
                </div>
                <ChevronRight className="size-5 text-slate-500" />
              </Link>
            ))}
          </div>

          <div className="rounded-[24px] border border-slate-700 bg-gradient-to-br from-emerald-500/10 to-slate-900 p-5">
            <div className="mb-4 flex items-center gap-2 text-emerald-300">
              <CalendarDays className="size-5" />
              <span className="text-xs uppercase tracking-[0.22em]">Next up</span>
            </div>
            {nextEvent ? (
              <div className="space-y-3">
                <p className="text-2xl font-bold text-white">{nextEvent.title}</p>
                <p className="text-slate-300">{nextEvent.clientName}</p>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
                  <div className="flex justify-between"><span>Date</span><span className="font-medium text-white">{nextEvent.eventDate}</span></div>
                  <div className="mt-2 flex justify-between"><span>Venue</span><span className="font-medium text-white">{nextEvent.venueName}</span></div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 p-6 text-slate-400">
                No current bookings.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
