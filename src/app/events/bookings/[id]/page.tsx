'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Calendar, Check, ChevronRight, Clock, Mail, MapPin, Phone, Plus, Truck, type LucideIcon } from 'lucide-react';
import { Booking, BookingStatus, STATUSES } from '@/lib/bookingTypes';
import { bookingKey, deleteBooking, getBooking, updateBooking } from '@/lib/bookingsApi';
import { peekCache } from '@/lib/clientCache';
import { useCachedData } from '@/hooks/useCachedData';
import { statusColor } from '@/components/booking/StatusBadge';
import ErrorState from '@/components/ui/ErrorState';
import { buildReminderMailto, getPartnerSettings } from '@/lib/partnerApi';
import { deriveEquipmentBreakdown } from '@/lib/equipmentBreakdown';
import ExpenseList from '@/components/expenses/ExpenseList';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import Screen from '@/components/navigation/Screen';

function formatDate(dateStr: string): string {
  if (!dateStr) return 'No date set';
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// "Sun, Oct 4"
function shortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

function whenLabel(dateStr: string): string | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(`${dateStr}T00:00:00`).getTime() - today.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  if (days === -1) return 'Yesterday';
  return `${-days} days ago`;
}

function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  // Opened from a list, the booking is usually cached already: show it at
  // once and refresh it from the server.
  const [booking, setBooking] = useState<Booking | null>(() => peekCache<Booking>(bookingKey(id)) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const partnerEmails = useCachedData('partner-settings', getPartnerSettings).data?.partnerEmails ?? [];
  const { openNewExpense } = useExpenseEntry();

  useEffect(() => {
    getBooking(id)
      .then((b) => (b ? setBooking(b) : setError('Booking not found.')))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load booking.'));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!booking) return <p className="py-20 text-center text-sm text-white/25">Loading…</p>;

  const handleStatusChange = async (status: BookingStatus) => {
    const updated = { ...booking, status };
    setBooking(updated);
    await updateBooking(updated);
  };

  const handleDelete = async () => {
    await deleteBooking(id);
    router.push('/events/bookings');
  };

  const when = whenLabel(booking.eventDate);
  const mapsHref = booking.venueAddress ? `https://maps.google.com/?q=${encodeURIComponent(booking.venueAddress)}` : undefined;
  const hasPickup = Boolean(booking.pickupDate || booking.pickupTime);

  return (
    <div className="space-y-4 pb-2">
      {/* Hero: status pill, the event name, and a two-tone supporting line. */}
      <section className="px-2 pb-3 pt-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.08] px-3 py-1 backdrop-blur">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: statusColor[booking.status] }} />
          <span className="text-[13px] font-semibold text-white/85">
            {booking.status}
            {when ? ` · ${when}` : ''}
          </span>
        </span>
        <h2 className="mt-4 text-[34px] font-bold leading-[1.1] tracking-tight text-white">{booking.eventTitle || 'Untitled event'}</h2>
        <p className="mx-auto mt-3 max-w-[320px] text-[16px] leading-snug text-white/85">
          {booking.eventType ? `${booking.eventType} event` : 'Event'}
          {booking.venueName ? <span className="text-white/45"> at {booking.venueName}</span> : null}
        </p>
      </section>

      {/* Key facts: when and where. */}
      <Panel>
        <InfoRow icon={Calendar} text={formatDate(booking.eventDate)} />
        <InfoRow
          icon={Clock}
          text={`${to12hr(booking.startTime)} – ${to12hr(booking.endTime)}`}
          sub={booking.setupTime ? `Setup ${to12hr(booking.setupTime)}` : undefined}
        />
        {hasPickup ? (
          <InfoRow
            icon={Truck}
            text={`Pickup${booking.pickupDate ? ` ${shortDate(booking.pickupDate)}` : ''}`}
            sub={booking.pickupTime ? to12hr(booking.pickupTime) : undefined}
          />
        ) : null}
        {booking.venueName || booking.venueAddress ? (
          <InfoRow icon={MapPin} text={booking.venueName || booking.venueAddress} sub={booking.venueName ? booking.venueAddress : undefined} href={mapsHref} />
        ) : null}

        <div className="my-1 border-t border-white/[0.07]" />

        {/* Client, with quiet round actions (Maps lives on the venue row). */}
        <div className="flex items-center gap-3 pt-1">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/35">Client</p>
            <p className="mt-0.5 truncate text-[16px] font-semibold text-white">{booking.clientName || 'No client name'}</p>
          </div>
          <RoundAction icon={Phone} label="Call client" href={booking.clientPhone ? `tel:${booking.clientPhone}` : undefined} />
          <RoundAction icon={Mail} label="Email client" href={booking.clientEmail ? `mailto:${booking.clientEmail}` : undefined} />
          <RoundAction icon={Bell} label="Remind partners" href={partnerEmails.length > 0 ? buildReminderMailto(booking, partnerEmails) : undefined} />
        </div>
      </Panel>

      {booking.services.length > 0 ? (
        <Panel title="Services">
          <ul className="space-y-3">
            {booking.services.map((s) => (
              <li key={s} className="flex items-center gap-3">
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-white">
                  <Check size={14} strokeWidth={3} className="text-[#0a0a0a]" />
                </span>
                <span className="text-[16px] text-white/90">{s}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {booking.equipment.length > 0 ? (
        <Panel title="Equipment" meta={`${booking.equipment.length} item${booking.equipment.length === 1 ? '' : 's'}`}>
          <ul className="divide-y divide-white/[0.07]">
            {booking.equipment.map((item) => {
              const breakdown = deriveEquipmentBreakdown(item.itemName, item.spec);
              return (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold text-white">{item.itemName}</p>
                      {item.spec ? <p className="mt-0.5 truncate text-[14px] text-white/45">{item.spec}</p> : null}
                    </div>
                    <span className="text-[16px] font-semibold tabular-nums text-white/85">×{item.qty}</span>
                  </div>
                  {breakdown.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {breakdown.map((line) => (
                        <span key={line.label} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-medium text-white/70">
                          {line.label} ×{line.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Expenses">
        <ExpenseList filter={{ event: booking.id }} showEvent={false} emptyText="No expenses for this event yet" />
        <button
          type="button"
          onClick={() => openNewExpense({ bookingId: booking.id })}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/[0.16] py-3 text-white"
        >
          <Plus size={16} />
          <span className="text-[15px] font-semibold">Add expense</span>
        </button>
      </Panel>

      {booking.notes ? (
        <Panel title="Notes">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-white/75">{booking.notes}</p>
        </Panel>
      ) : null}

      <Panel title="Status">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1" role="radiogroup" aria-label="Booking status">
          {STATUSES.map((s) => {
            const active = booking.status === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleStatusChange(s)}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition ${active ? 'bg-white/[0.12] text-white' : 'text-white/45'}`}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: statusColor[s], opacity: active ? 1 : 0.5 }} />
                <span className="text-[14px] font-semibold">{s}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* The one primary action; delete stays quiet and asks first. */}
      <div className="space-y-1 pt-2">
        <Link href={`/events/bookings/${id}/edit`} className="flex w-full items-center justify-center rounded-full bg-white py-3.5 text-[#0a0a0a]">
          <span className="text-[16px] font-semibold">Edit booking</span>
        </Link>
        {confirmingDelete ? (
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setConfirmingDelete(false)} className="flex-1 rounded-full border border-white/[0.16] py-3 text-white/80">
              <span className="text-[14px] font-semibold">Cancel</span>
            </button>
            <button type="button" onClick={handleDelete} className="flex-1 rounded-full bg-[var(--neon-pink)] py-3 text-[#0a0a0a]">
              <span className="text-[14px] font-semibold">Delete booking</span>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingDelete(true)} className="w-full py-3 text-[var(--neon-pink)]/80">
            <span className="text-[14px] font-semibold">Delete booking</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Panel({ title, meta, children }: { title?: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-[#0a0f16]/80 p-5 backdrop-blur-sm">
      {title ? (
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/40">{title}</h3>
          {meta ? <span className="text-[13px] text-white/35">{meta}</span> : null}
        </div>
      ) : null}
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

function InfoRow({ icon: Icon, text, sub, href }: { icon: LucideIcon; text: string; sub?: string; href?: string }) {
  if (!text) return null;
  const body = (
    <>
      <Icon size={20} strokeWidth={1.75} className="mt-px shrink-0 text-white/75" />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] leading-snug text-white">{text}</span>
        {sub ? <span className="mt-0.5 block text-[14px] text-white/45">{sub}</span> : null}
      </span>
      {href ? <ChevronRight size={18} className="mt-0.5 shrink-0 text-white/30" /> : null}
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-start gap-3.5">
      {body}
    </a>
  ) : (
    <div className="flex items-start gap-3.5">{body}</div>
  );
}

function RoundAction({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href?: string }) {
  const className = 'flex size-11 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06]';
  if (!href) {
    return (
      <span aria-label={`${label} (unavailable)`} className={`${className} text-white/20`}>
        <Icon size={18} />
      </span>
    );
  }
  return (
    <a href={href} aria-label={label} className={`${className} text-white`}>
      <Icon size={18} />
    </a>
  );
}

// Animated like a native screen push/pop (see components/navigation).
export default function Page(props: React.ComponentProps<typeof BookingDetailPage>) {
  return (
    <Screen title="Booking" hideTitle back backdrop>
      <BookingDetailPage {...props} />
    </Screen>
  );
}
