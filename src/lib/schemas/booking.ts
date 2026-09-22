import { z } from 'zod';

export const equipmentLineInputSchema = z.object({
  id: z.number().default(0),
  itemName: z.string().default(''),
  spec: z.string().default(''),
  qty: z.number().int().positive().default(1),
});

// Matches every NOT NULL column on the shared `bookings` table — required
// as strings (empty allowed) so a missing field fails validation here with
// a clear 400 instead of surfacing as a raw DB error later. `id`,
// `createdAt`, `updatedAt` are server-assigned and ignored if sent.
export const bookingInputSchema = z.object({
  eventTitle: z.string().default(''),
  clientName: z.string().default(''),
  clientEmail: z.string().default(''),
  clientPhone: z.string().default(''),
  eventType: z.string().default(''),
  venueName: z.string().default(''),
  venueAddress: z.string().default(''),
  eventDate: z.string().default(''),
  setupTime: z.string().default(''),
  startTime: z.string().default(''),
  endTime: z.string().default(''),
  pickupDate: z.string().default(''),
  pickupTime: z.string().default(''),
  notes: z.string().default(''),
  status: z.enum(['Tentative', 'Confirmed', 'Completed', 'Cancelled']).default('Tentative'),
  equipment: z.array(equipmentLineInputSchema).default([]),
  services: z.array(z.string()).default([]),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;
