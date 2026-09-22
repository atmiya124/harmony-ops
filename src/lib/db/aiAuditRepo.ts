import { db } from './client';
import { aiExtractionAudit } from './schema';
import { AiExtractionAuditInput } from '@/lib/schemas/aiExtractionAudit';
import { AI_EXTRACTION_MODEL } from '@/lib/aiModel';

export async function createAiExtractionAudit(input: AiExtractionAuditInput): Promise<void> {
  await db.insert(aiExtractionAudit).values({
    bookingId: input.bookingId,
    rawText: input.rawText,
    aiResult: JSON.stringify(input.aiResult),
    changes: JSON.stringify(input.changes),
    model: AI_EXTRACTION_MODEL,
    createdAt: new Date().toISOString(),
  });
}
