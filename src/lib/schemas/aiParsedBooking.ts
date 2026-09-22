import { z } from 'zod';

const confidenceSchema = z.enum(['confirmed', 'assumed', 'missing']);

// Validates the JSON the model returns from parse-booking's system prompt.
// Every field is defaulted so a partially-cooperative response still
// produces a usable draft instead of a 500 — isNearEmpty() (in the route)
// is what decides whether the draft is worth showing at all.
export const aiParsedBookingSchema = z.object({
  client: z
    .object({
      name: z.string().default(''),
      email: z.string().default(''),
      phone: z.string().default(''),
    })
    .default({ name: '', email: '', phone: '' }),
  schedule: z
    .object({
      eventDate: z.string().default(''),
      setupTime: z.string().default(''),
      startTime: z.string().default(''),
      endTime: z.string().default(''),
      pickupDate: z.string().default(''),
      pickupTime: z.string().default(''),
    })
    .default({ eventDate: '', setupTime: '', startTime: '', endTime: '', pickupDate: '', pickupTime: '' }),
  venue: z
    .object({
      eventType: z.string().default(''),
      location: z.string().default(''),
    })
    .default({ eventType: '', location: '' }),
  equipment: z
    .array(
      z.object({
        itemName: z.string().default(''),
        spec: z.string().default(''),
        qty: z.coerce.number().int().positive().default(1),
        confidence: confidenceSchema.default('assumed'),
      }),
    )
    .default([]),
  services: z
    .array(
      z.object({
        name: z.string().default(''),
        confidence: confidenceSchema.default('assumed'),
      }),
    )
    .default([]),
  notes: z.string().default(''),
  confidence: z.record(z.string(), confidenceSchema).default({}),
});

export type AiParsedBookingParsed = z.infer<typeof aiParsedBookingSchema>;
