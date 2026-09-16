'use client';

import { use, useState } from 'react';
import { initialEvents, type BookingStatus } from '@/lib/harmony-data';
import { Mail, MapPin, Monitor, Phone, Send, Sparkles, User, Zap } from 'lucide-react';

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const booking = initialEvents.find((event) => String(event.id) === id) ?? initialEvents[0];
  const [selectedStatus, setSelectedStatus] = useState<BookingStatus>(booking.status);

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <div className="rounded-[28px] border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Booking detail</p>
            <h2 className="mt-2 text-3xl font-bold text-white">{booking.title}</h2>
          </div>
          <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">
            <Send className="size-4" />
            Send partner reminder
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-[24px] border border-slate-700 bg-slate-950/50 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoRow label="Client" value={booking.clientName} icon={User} />
              <InfoRow label="Phone" value={booking.clientPhone} icon={Phone} />
              <InfoRow label="Email" value={booking.clientEmail} icon={Mail} />
              <InfoRow label="Venue" value={booking.venueName} icon={MapPin} />
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Schedule</p>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between"><span>Date</span><span className="font-medium text-white">{booking.eventDate}</span></div>
                <div className="flex justify-between"><span>Setup</span><span className="font-medium text-white">{booking.setupTime}</span></div>
                <div className="flex justify-between"><span>Start</span><span className="font-medium text-white">{booking.startTime}</span></div>
                <div className="flex justify-between"><span>End</span><span className="font-medium text-white">{booking.endTime}</span></div>
                <div className="flex justify-between"><span>Pickup</span><span className="font-medium text-white">{booking.pickupDetail}</span></div>
              </div>
            </div>

            {booking.services.length > 0 && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <div className="mb-2 flex items-center gap-2 text-slate-400">
                  <Sparkles className="size-4 text-emerald-300" />
                  <span className="text-xs uppercase tracking-[0.2em]">Services</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {booking.services.map((service) => (
                    <span key={service} className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {booking.attachedSpecs && booking.attachedSpecs.length > 0 && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <div className="mb-2 flex items-center gap-2 text-slate-400">
                  <Monitor className="size-4 text-cyan-300" />
                  <span className="text-xs uppercase tracking-[0.2em]">Attached calculator specs</span>
                </div>
                <div className="space-y-2">
                  {booking.attachedSpecs.map((spec, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2 rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-300">
                      <span>{spec.dimensions}</span>
                      <span>{spec.resolution}</span>
                      <span className="flex items-center gap-1 text-amber-200">
                        <Zap className="size-3.5" />
                        {spec.powerDraw}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-[24px] border border-slate-700 bg-gradient-to-br from-emerald-500/10 to-slate-900 p-5">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as BookingStatus)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-white"
              >
                <option value="Tentative">Tentative</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Equipment</p>
              <div className="space-y-2">
                {booking.equipment.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">
                    <div className="flex justify-between"><span className="font-medium text-white">{item.name}</span><span>{item.qty}</span></div>
                    <div className="mt-1 text-slate-400">{item.dimensions}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Notes</p>
              <p className="text-sm text-slate-300">{booking.notes}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon: typeof User }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        <Icon className="size-4 text-emerald-300" />
        <span className="text-xs uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="text-base font-semibold text-white">{value}</p>
    </div>
  );
}
