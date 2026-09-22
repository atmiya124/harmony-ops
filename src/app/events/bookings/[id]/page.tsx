'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bell, Calendar, Clock, Edit3, Mail, MapPin, Phone, Trash2, Truck } from 'lucide-react';
import { Booking, BookingStatus, STATUSES } from '@/lib/bookingTypes';
import { deleteBooking, getBooking, updateBooking } from '@/lib/bookingsApi';
import StatusBadge, { statusColor } from '@/components/booking/StatusBadge';
import ActionLink from '@/components/booking/ActionLink';
import ErrorState from '@/components/ui/ErrorState';
import { buildReminderMailto, getPartnerSettings } from '@/lib/partnerApi';
import { colorAlpha } from '@/lib/colorAlpha';
import { deriveEquipmentBreakdown } from '@/lib/equipmentBreakdown';

function formatDate(dateStr: string): string {
  if (!dateStr) return 'No date set';
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [partnerEmails, setPartnerEmails] = useState<string[]>([]);

  useEffect(() => {
    getBooking(id)
      .then((b) => (b ? setBooking(b) : setError('Booking not found.')))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load booking.'));
    getPartnerSettings()
      .then((s) => setPartnerEmails(s.partnerEmails))
      .catch(() => {});
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!booking) return <p className="py-20 text-center text-sm text-[var(--flat-text-ghost)]">Loading…</p>;

  const accent = statusColor[booking.status];

  const handleStatusChange = async (status: BookingStatus) => {
    const updated = { ...booking, status };
    setBooking(updated);
    await updateBooking(updated);
  };

  const handleDelete = async () => {
    await deleteBooking(id);
    router.push('/events/bookings');
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border p-4" style={{ borderColor: colorAlpha(accent, 35), backgroundColor: colorAlpha(accent, 14) }}>
        <Link href="/events/bookings" className="mb-2 inline-flex size-7 items-center justify-center text-white">
          <ArrowLeft size={18} />
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--flat-text-faint)]">{booking.eventType}</p>
        <p className="mt-1 text-xl font-bold text-white">{booking.eventTitle || 'Untitled event'}</p>
        <div className="mt-2">
          <StatusBadge status={booking.status} large />
        </div>
      </div>

      <Card title="Event Details">
        <div className="mb-1 flex items-center gap-2.5 rounded-lg border border-[rgba(0,212,255,0.3)] bg-[rgba(0,212,255,0.1)] px-3 py-2.5">
          <Calendar size={16} className="shrink-0 text-[var(--neon-cyan)]" />
          <p className="text-sm font-bold text-[var(--neon-cyan)]">{formatDate(booking.eventDate)}</p>
        </div>
        <DetailRow icon={Clock} color="var(--neon-purple)" text={`Setup ${to12hr(booking.setupTime)} · Start ${to12hr(booking.startTime)} · End ${to12hr(booking.endTime)}`} />
        {Boolean(booking.pickupDate || booking.pickupTime) && (
          <DetailRow icon={Truck} color="var(--neon-orange)" text={`Pickup ${booking.pickupDate ? formatDate(booking.pickupDate) : ''} ${to12hr(booking.pickupTime)}`} />
        )}
        <DetailRow icon={MapPin} color="var(--neon-pink)" text={booking.venueName} sub={booking.venueAddress || undefined} />

        {booking.notes ? (
          <div className="mt-1 rounded-lg border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.1)] p-2.5">
            <p className="mb-0.5 text-[10px] font-bold text-[var(--neon-orange)]">Notes</p>
            <p className="text-xs leading-relaxed text-[var(--flat-text-dim)]">{booking.notes}</p>
          </div>
        ) : null}
      </Card>

      {booking.equipment.length > 0 && (
        <Card title="Equipment" badge={`${booking.equipment.length} items`}>
          {booking.equipment.map((item, i) => {
            const breakdown = deriveEquipmentBreakdown(item.itemName, item.spec);
            return (
              <div key={item.id} className={`py-2.5 ${i === booking.equipment.length - 1 ? '' : 'border-b border-[var(--flat-border)]'}`}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-white">{item.itemName}</p>
                    {item.spec ? <p className="mt-0.5 truncate text-[11px] text-[var(--flat-text-faint)]">{item.spec}</p> : null}
                  </div>
                  <span className="text-[15px] font-bold text-[var(--neon-cyan)]">×{item.qty}</span>
                </div>
                {breakdown.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {breakdown.map((line) => (
                      <span
                        key={line.label}
                        className="rounded-md px-2 py-1 text-[11px] font-bold text-[var(--neon-cyan)]"
                        style={{ backgroundColor: colorAlpha('var(--neon-cyan)', 10) }}
                      >
                        {line.label} ×{line.value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </Card>
      )}

      {booking.services.length > 0 && (
        <Card title="Services">
          <div className="flex flex-wrap gap-1.5">
            {booking.services.map((s) => (
              <span key={s} className="rounded-full bg-[rgba(52,211,153,0.15)] px-2.5 py-1 text-[11px] text-[var(--neon-mint)]">
                {s}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card title="Client">
        <p className="mb-3 text-[15px] font-bold text-white">{booking.clientName || 'No client name'}</p>
        <div className="flex gap-2">
          <ActionLink icon={Phone} label="Call" color="var(--neon-green)" href={booking.clientPhone ? `tel:${booking.clientPhone}` : undefined} />
          <ActionLink
            icon={MapPin}
            label="Maps"
            color="var(--neon-cyan)"
            href={booking.venueAddress ? `https://maps.google.com/?q=${encodeURIComponent(booking.venueAddress)}` : undefined}
          />
          <ActionLink icon={Mail} label="Email" color="var(--neon-purple)" href={booking.clientEmail ? `mailto:${booking.clientEmail}` : undefined} />
          <ActionLink
            icon={Bell}
            label="Remind"
            color="var(--neon-orange)"
            href={partnerEmails.length > 0 ? buildReminderMailto(booking, partnerEmails) : undefined}
          />
        </div>
      </Card>

      <Card title="Actions">
        <p className="mb-2 text-[11px] text-[var(--flat-text-faint)]">Change status</p>
        <div className="mb-3.5 grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusChange(s)}
              className="rounded-lg border py-2.5 text-xs font-bold"
              style={
                booking.status === s
                  ? { backgroundColor: statusColor[s], borderColor: statusColor[s], color: '#0a0a0a' }
                  : { borderColor: 'var(--flat-border)', backgroundColor: 'var(--flat-surface-input)', color: 'var(--flat-text-dim)' }
              }
            >
              {s}
            </button>
          ))}
        </div>

        <Link
          href={`/events/bookings/${id}/edit`}
          className="mb-2.5 flex items-center justify-center gap-2 rounded-xl bg-[var(--neon-cyan)] py-3.5 text-[13px] font-bold text-[#0a0a0a]"
        >
          <Edit3 size={16} /> Edit Booking
        </Link>

        {confirmingDelete ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmingDelete(false)} className="flex-1 rounded-xl border border-[var(--flat-border)] py-3.5 text-[13px] font-bold text-[var(--flat-text-dim)]">
              Cancel
            </button>
            <button type="button" onClick={handleDelete} className="flex-1 rounded-xl bg-[var(--neon-pink)] py-3.5 text-[13px] font-bold text-[#0a0a0a]">
              Confirm delete
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[rgba(244,114,182,0.4)] py-3.5 text-[13px] font-bold text-[var(--neon-pink)]"
          >
            <Trash2 size={16} /> Delete Booking
          </button>
        )}
      </Card>
    </div>
  );
}

function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">{title}</p>
        {badge ? <span className="rounded-full bg-[var(--flat-surface-input)] px-2 py-0.5 text-[11px] text-[var(--flat-text-faint)]">{badge}</span> : null}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function DetailRow({ icon: Icon, color, text, sub }: { icon: typeof Calendar; color: string; text: string; sub?: string }) {
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

