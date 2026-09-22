'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NewBookingForm from '@/components/booking/NewBookingForm';
import AiReviewPanel from '@/components/booking/AiReviewPanel';
import { Booking, blankBooking } from '@/lib/bookingTypes';
import { createBooking } from '@/lib/bookingsApi';
import { AiParsedBooking } from '@/lib/aiParse';
import { logAiExtraction } from '@/lib/aiAuditApi';
import type { AiExtractionChanges } from '@/lib/schemas/aiExtractionAudit';

export default function NewBookingPage() {
  const router = useRouter();
  const [parsed, setParsed] = useState<AiParsedBooking | null>(null);
  const [rawText, setRawText] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAiParsed = (result: AiParsedBooking, text: string) => {
    setParsed(result);
    setRawText(text);
  };

  const handleSave = async (booking: Booking) => {
    setSaveError(null);
    try {
      const created = await createBooking(booking);
      router.push(`/events/bookings/${created.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save booking.');
    }
  };

  const handleAiConfirm = async (booking: Booking, changes: AiExtractionChanges) => {
    setSaveError(null);
    try {
      const created = await createBooking(booking);
      logAiExtraction({ bookingId: created.id, rawText, aiResult: parsed!, changes });
      router.push(`/events/bookings/${created.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save booking.');
    }
  };

  return (
    <div>
      {saveError && (
        <p className="mb-3 rounded-lg border border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.08)] px-3 py-2 text-xs text-[var(--neon-pink)]">
          {saveError}
        </p>
      )}
      {parsed ? (
        <AiReviewPanel parsed={parsed} onCancel={() => setParsed(null)} onConfirm={handleAiConfirm} />
      ) : (
        <NewBookingForm initial={blankBooking()} isEdit={false} onCancel={() => router.back()} onSave={handleSave} onAiParsed={handleAiParsed} />
      )}
    </div>
  );
}
