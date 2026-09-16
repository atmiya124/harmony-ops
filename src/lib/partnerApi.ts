import { Booking } from './bookingTypes';

export interface PartnerSettings {
  companyName: string;
  partnerEmails: string[];
}

export async function getPartnerSettings(): Promise<PartnerSettings> {
  const res = await fetch('/api/partner-settings');
  if (!res.ok) throw new Error('Failed to load partner settings');
  return res.json();
}

export function buildReminderMailto(booking: Booking, partnerEmails: string[]): string {
  const subject = `Reminder: ${booking.eventTitle || 'Untitled event'} — ${booking.eventDate}`;
  const lines = [
    `Event: ${booking.eventTitle || 'Untitled event'}`,
    `Client: ${booking.clientName || '—'}`,
    `Date: ${booking.eventDate || '—'}`,
    `Setup: ${booking.setupTime || '—'} · Start: ${booking.startTime || '—'} · End: ${booking.endTime || '—'}`,
    `Venue: ${booking.venueName || '—'}${booking.venueAddress ? ` (${booking.venueAddress})` : ''}`,
    booking.notes ? `Notes: ${booking.notes}` : '',
  ].filter(Boolean);
  const body = lines.join('\n');
  return `mailto:${partnerEmails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
