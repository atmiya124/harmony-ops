'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarDays, ChevronRight, Plus } from 'lucide-react';
import { initialEvents } from '@/lib/harmony-data';

export default function BookingsPage() {
  const [events] = useState(initialEvents);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="rounded-[28px] border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Bookings</p>
            <h2 className="mt-2 text-3xl font-bold text-white">All bookings</h2>
          </div>
          <Link
            href="/events/bookings/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            <Plus className="size-4" />
            New booking
          </Link>
        </div>

        <div className="space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/bookings/${event.id}`}
              className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/50 p-4 transition hover:border-slate-500"
            >
              <div>
                <p className="text-lg font-semibold text-white">{event.title}</p>
                <p className="text-sm text-slate-400">{event.clientName} · {event.eventDate}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200">{event.status}</span>
                <ChevronRight className="size-5 text-slate-500" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
