import Link from 'next/link';
import { Tag } from 'lucide-react';
import { Booking } from '@/lib/bookingTypes';
import { statusColor } from './StatusBadge';
import { colorAlpha } from '@/lib/colorAlpha';

interface UpcomingTimelineProps {
  bookings: Booking[];
  highlightFirst?: boolean;
}

function dayParts(dateStr: string): { day: string; month: string } {
  if (!dateStr) return { day: '—', month: '' };
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return { day: d.toLocaleDateString('en-US', { day: 'numeric' }), month: d.toLocaleDateString('en-US', { month: 'short' }) };
  } catch {
    return { day: '—', month: '' };
  }
}

export default function UpcomingTimeline({ bookings, highlightFirst = true }: UpcomingTimelineProps) {
  return (
    <div className="space-y-2.5">
      {bookings.map((b, i) => {
        const { day, month } = dayParts(b.eventDate);
        const highlighted = highlightFirst && i === 0;
        return (
          <Link key={b.id} href={`/events/bookings/${b.id}`} className="flex items-stretch gap-3">
            <div
              className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border py-2"
              style={
                highlighted
                  ? { backgroundColor: 'var(--flat-surface-alt)', borderColor: 'transparent' }
                  : { backgroundColor: 'var(--flat-surface)', borderColor: 'var(--flat-border)' }
              }
            >
              <span className={`text-xl font-bold leading-none ${highlighted ? 'text-[var(--neon-cyan)]' : 'text-white'}`}>{day}</span>
              <span className={`mt-1 text-[11px] uppercase tracking-wide ${highlighted ? 'text-[var(--neon-cyan)]' : 'text-[var(--flat-text-faint)]'}`}>
                {month}
              </span>
            </div>

            <div
              className="min-w-0 flex-1 rounded-xl p-3.5"
              style={
                highlighted
                  ? { background: 'linear-gradient(135deg, var(--neon-cyan) 0%, #6dd5ed 100%)' }
                  : { backgroundColor: 'var(--flat-surface)', border: '1px solid var(--flat-border)' }
              }
            >
              <p className={`truncate text-[15px] font-bold ${highlighted ? 'text-[#04141a]' : 'text-white'}`}>
                {b.eventTitle || 'Untitled event'}
              </p>
              <p className={`mt-0.5 truncate text-xs ${highlighted ? 'text-[#04141a]/70' : 'text-[var(--flat-text-faint)]'}`}>
                {b.clientName || 'No client name'}
              </p>

              <div className="mt-2.5 flex items-center gap-2">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: highlighted ? 'rgba(4,20,26,0.15)' : colorAlpha(statusColor[b.status], 20) }}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: highlighted ? '#04141a' : statusColor[b.status] }} />
                </span>
                {b.eventType ? (
                  <span
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium"
                    style={highlighted ? { backgroundColor: 'rgba(4,20,26,0.15)', color: '#04141a' } : { backgroundColor: 'var(--flat-surface-input)', color: 'var(--flat-text-dim)' }}
                  >
                    <Tag size={11} />
                    {b.eventType}
                  </span>
                ) : null}
                <span className={`ml-auto shrink-0 text-[11px] font-medium ${highlighted ? 'text-[#04141a]' : 'text-[var(--flat-text-faint)]'}`}>
                  {b.startTime || '—'} – {b.endTime || '—'}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
