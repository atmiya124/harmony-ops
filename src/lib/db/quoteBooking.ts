// A quote the client accepted becomes a booking. Called right after the
// client accepts through their secure link, and by the "Create booking"
// recovery action on Quote Details — never by a manual status change:
//   - no linked booking yet: create a Confirmed booking from the quote's
//     client, event and venue, with its items as the equipment list, and
//     link the quote to it;
//   - already linked: confirm that booking if it's still Tentative.
// Everything happens in one transaction and the quote is linked only if it
// still has no booking, so a repeat or a race can never make two bookings.
// A quote has no times or event type: those are left for staff to fill in.
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from './client';
import { bookingEquipment, bookings, quoteAcceptances, quoteItems, quotes, salesAuditLog } from './schema';
import { nowIso } from './financeRepo';

// Who made the quote Accepted, for the quote's history.
export type AcceptedBy = { userId: string; email: string };

export type QuoteBookingResult = { bookingId: number; created: boolean } | null;

const AUTO_EVENT_TYPE = 'Other';

export async function bookAcceptedQuote(quoteId: string, by: AcceptedBy): Promise<QuoteBookingResult> {
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(and(eq(quotes.id, quoteId), isNull(quotes.deletedAt)));
    if (!quote || (quote.status !== 'accepted' && quote.status !== 'converted')) return null;
    // Only a real client acceptance books: the client's latest answer through
    // their link must be an acceptance. A quote marked Accepted by hand has
    // none, so it never becomes a booking here.
    const [answer] = await tx
      .select({ action: quoteAcceptances.action })
      .from(quoteAcceptances)
      .where(eq(quoteAcceptances.quoteId, quoteId))
      .orderBy(desc(quoteAcceptances.createdAt))
      .limit(1);
    if (answer?.action !== 'accepted') return null;
    const at = nowIso();

    if (quote.eventId !== null) {
      const [linked] = await tx.select({ id: bookings.id, status: bookings.status }).from(bookings).where(eq(bookings.id, quote.eventId));
      // A booking deleted in Event-booking-app stays deleted; nothing to confirm.
      if (!linked) return null;
      if (linked.status === 'Tentative') await tx.update(bookings).set({ status: 'Confirmed', updatedAt: at }).where(eq(bookings.id, linked.id));
      return { bookingId: linked.id, created: false };
    }

    const items = await tx.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId)).orderBy(asc(quoteItems.sortOrder));
    const notes = [`Created automatically from accepted quote ${quote.quoteNumber}.`, quote.notes?.trim()].filter(Boolean).join('\n\n');
    const [booking] = await tx
      .insert(bookings)
      .values({
        eventTitle: quote.eventName?.trim() || `${quote.customerName} event`,
        clientName: quote.customerName,
        clientEmail: quote.customerEmail ?? '',
        clientPhone: quote.customerPhone ?? '',
        eventDate: quote.eventDate ?? '',
        setupTime: '',
        startTime: '',
        endTime: '',
        venueName: quote.venueName ?? '',
        venueAddress: quote.venueAddress ?? '',
        eventType: AUTO_EVENT_TYPE,
        notes,
        status: 'Confirmed',
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: bookings.id });
    if (items.length > 0) {
      await tx.insert(bookingEquipment).values(
        items.map((item, i) => ({ bookingId: booking.id, itemName: item.itemName, spec: item.description, qty: item.quantity, sortOrder: i })),
      );
    }

    // Link the quote — only if nothing else linked it meanwhile; otherwise
    // throw, so the booking just made is rolled back with the transaction.
    const [linked] = await tx
      .update(quotes)
      .set({ eventId: booking.id })
      .where(and(eq(quotes.id, quoteId), isNull(quotes.eventId)))
      .returning();
    if (!linked) throw new Error('Quote was linked to a booking at the same time');
    await tx.insert(salesAuditLog).values({
      entityType: 'quote',
      entityId: quoteId,
      action: 'update',
      changedByUserId: by.userId,
      changedByEmail: by.email,
      changedAt: at,
      before: JSON.stringify(quote),
      after: JSON.stringify({ ...linked, note: `Booking #${booking.id} created from this accepted quote` }),
    });
    return { bookingId: booking.id, created: true };
  });
}

// For the accept paths: a booking problem must never undo or block the
// acceptance itself, so failures are logged and the acceptance stands.
export async function bookAcceptedQuoteSafely(quoteId: string, by: AcceptedBy): Promise<QuoteBookingResult> {
  try {
    return await bookAcceptedQuote(quoteId, by);
  } catch (err) {
    console.error(`[quotes] creating a booking for accepted quote ${quoteId} failed:`, err);
    return null;
  }
}
