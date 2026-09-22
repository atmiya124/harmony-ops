import { AiExtractionChanges } from '@/lib/schemas/aiExtractionAudit';
import { AiParsedBooking } from '@/lib/aiParse';

// Fire-and-forget: logging failures should never surface to the user or
// block the save flow they already completed.
export function logAiExtraction(input: { bookingId: number; rawText: string; aiResult: AiParsedBooking; changes: AiExtractionChanges }): void {
  fetch('/api/ai-audit-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => {
    // best-effort — nothing to recover here
  });
}
