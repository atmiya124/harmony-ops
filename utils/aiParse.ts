import type { AiParsedBooking } from '../api/parse-booking';

export type { AiConfidence, AiFieldMeta, AiParsedBooking, AiParsedEquipmentItem } from '../api/parse-booking';

export class AiParseError extends Error {}

export async function parseBookingEmail(text: string): Promise<AiParsedBooking> {
  const response = await fetch('/api/parse-booking', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AiParseError('The server returned an unreadable response.');
  }

  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error || `Request failed (${response.status})`;
    throw new AiParseError(message);
  }

  return payload as AiParsedBooking;
}
