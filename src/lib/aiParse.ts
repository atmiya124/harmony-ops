export type AiConfidence = 'confirmed' | 'assumed' | 'missing';

export interface AiParsedEquipmentLine {
  itemName: string;
  spec: string;
  qty: number;
  confidence: AiConfidence;
}

export interface AiParsedServiceLine {
  name: string;
  confidence: AiConfidence;
}

export interface AiParsedBooking {
  client: { name: string; email: string; phone: string };
  schedule: {
    eventDate: string;
    setupTime: string;
    startTime: string;
    endTime: string;
    pickupDate: string;
    pickupTime: string;
  };
  venue: { eventType: string; location: string };
  equipment: AiParsedEquipmentLine[];
  services: AiParsedServiceLine[];
  notes: string;
  // Dot-path keyed, one entry per scalar field in client/schedule/venue,
  // e.g. "client.name", "schedule.eventDate".
  confidence: Record<string, AiConfidence>;
}

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
