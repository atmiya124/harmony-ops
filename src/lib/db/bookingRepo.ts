import { eq } from 'drizzle-orm';
import { db } from './client';
import { bookings, bookingEquipment, bookingServices } from './schema';
import { Booking, EquipmentLine } from '../bookingTypes';

function nowIso(): string {
  return new Date().toISOString();
}

function rowToBooking(
  row: typeof bookings.$inferSelect,
  equipment: (typeof bookingEquipment.$inferSelect)[],
  services: (typeof bookingServices.$inferSelect)[],
): Booking {
  return {
    id: row.id,
    eventTitle: row.eventTitle,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    eventType: row.eventType,
    venueName: row.venueName,
    venueAddress: row.venueAddress,
    eventDate: row.eventDate,
    setupTime: row.setupTime,
    startTime: row.startTime,
    endTime: row.endTime,
    pickupDate: row.pickupDate ?? '',
    pickupTime: row.pickupTime ?? '',
    notes: row.notes ?? '',
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    equipment: equipment
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e): EquipmentLine => ({ id: e.id, itemName: e.itemName, spec: e.spec ?? '', qty: e.qty })),
    services: services.map((s) => s.serviceName),
  };
}

export async function listBookings(): Promise<Booking[]> {
  const rows = await db.select().from(bookings);
  const allEquipment = await db.select().from(bookingEquipment);
  const allServices = await db.select().from(bookingServices);
  return rows
    .map((row) =>
      rowToBooking(
        row,
        allEquipment.filter((e) => e.bookingId === row.id),
        allServices.filter((s) => s.bookingId === row.id),
      ),
    )
    .sort((a, b) => b.id - a.id);
}

export async function getBookingById(id: number): Promise<Booking | null> {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!row) return null;
  const equipment = await db.select().from(bookingEquipment).where(eq(bookingEquipment.bookingId, id));
  const services = await db.select().from(bookingServices).where(eq(bookingServices.bookingId, id));
  return rowToBooking(row, equipment, services);
}

async function replaceLineItems(bookingId: number, booking: Booking) {
  await db.delete(bookingEquipment).where(eq(bookingEquipment.bookingId, bookingId));
  await db.delete(bookingServices).where(eq(bookingServices.bookingId, bookingId));

  if (booking.equipment.length > 0) {
    await db.insert(bookingEquipment).values(
      booking.equipment.map((e, i) => ({
        bookingId,
        itemName: e.itemName,
        spec: e.spec || null,
        qty: e.qty,
        sortOrder: i,
      })),
    );
  }

  if (booking.services.length > 0) {
    await db.insert(bookingServices).values(booking.services.map((serviceName) => ({ bookingId, serviceName })));
  }
}

export async function createBooking(booking: Booking): Promise<Booking> {
  const now = nowIso();
  const [inserted] = await db
    .insert(bookings)
    .values({
      eventTitle: booking.eventTitle,
      clientName: booking.clientName,
      clientPhone: booking.clientPhone,
      clientEmail: booking.clientEmail,
      eventDate: booking.eventDate,
      setupTime: booking.setupTime,
      startTime: booking.startTime,
      endTime: booking.endTime,
      venueName: booking.venueName,
      venueAddress: booking.venueAddress,
      eventType: booking.eventType,
      notes: booking.notes || null,
      status: booking.status,
      createdAt: now,
      updatedAt: now,
      pickupDate: booking.pickupDate || null,
      pickupTime: booking.pickupTime || null,
    })
    .returning();
  await replaceLineItems(inserted.id, booking);
  return (await getBookingById(inserted.id))!;
}

export async function updateBooking(id: number, booking: Booking): Promise<Booking | null> {
  const existing = await getBookingById(id);
  if (!existing) return null;
  await db
    .update(bookings)
    .set({
      eventTitle: booking.eventTitle,
      clientName: booking.clientName,
      clientPhone: booking.clientPhone,
      clientEmail: booking.clientEmail,
      eventDate: booking.eventDate,
      setupTime: booking.setupTime,
      startTime: booking.startTime,
      endTime: booking.endTime,
      venueName: booking.venueName,
      venueAddress: booking.venueAddress,
      eventType: booking.eventType,
      notes: booking.notes || null,
      status: booking.status,
      updatedAt: nowIso(),
      pickupDate: booking.pickupDate || null,
      pickupTime: booking.pickupTime || null,
    })
    .where(eq(bookings.id, id));
  await replaceLineItems(id, booking);
  return getBookingById(id);
}

export async function deleteBooking(id: number): Promise<void> {
  await db.delete(bookings).where(eq(bookings.id, id));
}
