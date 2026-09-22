import { z } from 'zod';

const fieldChangeSchema = z.object({
  path: z.string(),
  from: z.string(),
  to: z.string(),
});

const listChangeSchema = z.object({
  from: z.array(z.unknown()),
  to: z.array(z.unknown()),
});

// The diff between the AI draft and what the staff member actually saved —
// only present where something changed.
export const aiExtractionChangesSchema = z.object({
  fields: z.array(fieldChangeSchema).default([]),
  equipment: listChangeSchema.nullable().default(null),
  services: listChangeSchema.nullable().default(null),
  notes: z.object({ from: z.string(), to: z.string() }).nullable().default(null),
});

export const aiExtractionAuditInputSchema = z.object({
  bookingId: z.number().int().positive(),
  rawText: z.string(),
  aiResult: z.unknown(),
  changes: aiExtractionChangesSchema,
});

export type AiExtractionChanges = z.infer<typeof aiExtractionChangesSchema>;
export type AiExtractionAuditInput = z.infer<typeof aiExtractionAuditInputSchema>;
