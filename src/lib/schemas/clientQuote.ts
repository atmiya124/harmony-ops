import { z } from 'zod';
import { MAX_SIGNATURE_DATA_LENGTH } from '../sales/types';

// Validation for what a client sends from the public quote page. Nothing
// here identifies the quote — that comes only from the link's token, on the
// server.

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// A drawn signature: a PNG (checked by its real file signature, not just the
// label), small enough to keep with the acceptance record.
export function isPngDataUrl(value: string): boolean {
  if (value.length > MAX_SIGNATURE_DATA_LENGTH) return false;
  const m = PNG_DATA_URL.exec(value);
  if (!m) return false;
  const bytes = Buffer.from(m[1], 'base64');
  return bytes.length > PNG_MAGIC.length && bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
}

// Collapse whitespace so "  Daniel   Smith " is stored as "Daniel Smith".
const personText = (max: number, message: string) =>
  z
    .string(message)
    .transform((s) => s.replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(1, message).max(max, `Keep it under ${max} characters`));

const signatureSchema = z.discriminatedUnion(
  'type',
  [
    z.object({ type: z.literal('typed'), value: personText(120, 'Type your name as your signature') }),
    z.object({
      type: z.literal('drawn'),
      value: z.string('Draw your signature').refine(isPngDataUrl, 'Draw your signature again'),
    }),
  ],
  'Add your signature',
);

export const quoteAcceptInputSchema = z.object({
  // The quote version the client was shown; acceptance is refused if staff
  // changed the quote since.
  version: z.string().min(1).max(64),
  customerName: personText(120, 'Enter your full name'),
  customerTitle: z
    .string()
    .transform((s) => s.replace(/\s+/g, ' ').trim())
    .pipe(z.string().max(120, 'Keep it under 120 characters'))
    .nullish()
    .transform((v) => (v ? v : null)),
  acceptedTerms: z.literal(true, 'Tick the box to accept the quote and its terms'),
  signature: signatureSchema,
});
export type QuoteAcceptInput = z.output<typeof quoteAcceptInputSchema>;

export const quoteDeclineInputSchema = z.object({
  version: z.string().min(1).max(64),
  reason: z
    .string()
    .trim()
    .max(1000, 'Keep it under 1,000 characters')
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type QuoteDeclineInput = z.output<typeof quoteDeclineInputSchema>;
