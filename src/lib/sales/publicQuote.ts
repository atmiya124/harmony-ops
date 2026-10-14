// What a client sees through their quote link — an explicit whitelist built
// from the saved quote. Internal fields (database ids, staff emails, audit
// history, internal status names, the linked booking, invoices) are never
// copied in, so they can't leak. Amounts are the stored, server-calculated
// figures.

import type { QuoteDto } from '../db/quoteRepo';
import { formatBp } from './inputs';
import { groupBySection } from './quoteDraft';

// open: can be accepted or declined. expired: past its valid-until date.
// unavailable: not shared yet (draft) or withdrawn (cancelled).
export type PublicQuoteState = 'open' | 'accepted' | 'declined' | 'expired' | 'unavailable';

export interface PublicQuoteItem {
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  discountCents: number;
  discountLabel: string | null; // "10%" for a percentage discount
  netTotalCents: number;
}

export interface PublicQuoteResponse {
  action: 'accepted' | 'declined';
  name: string | null; // who accepted (declines don't need a name)
  title: string | null;
  at: string; // ISO timestamp
}

export interface PublicQuote {
  version: string; // sent back on accept/decline; changes when staff edit the quote
  state: PublicQuoteState;
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;
  customer: { name: string; company: string | null; email: string | null; phone: string | null; addressLines: string[] };
  event: { name: string | null; date: string | null; venue: string | null } | null;
  sections: { name: string; items: PublicQuoteItem[] }[];
  totals: {
    itemDiscountsCents: number;
    subtotalCents: number;
    discountLabel: string | null; // "Discount 5%" or "Discount"; null = none
    discountCents: number;
    taxLabel: string | null; // "HST 13%"; null = no tax
    taxCents: number;
    totalCents: number;
    depositLabel: string | null; // "Deposit required (50%)"; null = none
    depositRequiredCents: number;
  };
  notes: string | null;
  terms: string[];
  response: PublicQuoteResponse | null;
}

export function publicQuoteState(status: QuoteDto['status'], validUntil: string, today: string): PublicQuoteState {
  if (status === 'accepted' || status === 'converted') return 'accepted';
  if (status === 'declined') return 'declined';
  if (status === 'draft' || status === 'cancelled') return 'unavailable';
  if (status === 'expired' || validUntil < today) return 'expired';
  return 'open'; // sent, viewed
}

const lines = (text: string | null) =>
  (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

export function toPublicQuote(q: QuoteDto, response: PublicQuoteResponse | null, today: string): PublicQuote {
  const venue = [q.venueName, q.venueAddress].filter(Boolean).join(', ') || null;
  const hasEvent = Boolean(q.eventName || q.eventDate || venue);
  return {
    version: q.updatedAt,
    state: publicQuoteState(q.status, q.validUntil, today),
    quoteNumber: q.quoteNumber,
    quoteDate: q.quoteDate,
    validUntil: q.validUntil,
    customer: {
      name: q.customerName,
      company: q.customerCompany,
      email: q.customerEmail,
      phone: q.customerPhone,
      addressLines: lines(q.billingAddress),
    },
    event: hasEvent ? { name: q.eventName, date: q.eventDate, venue } : null,
    sections: groupBySection(q.items).map((g) => ({
      name: g.section,
      items: g.items.map((i) => ({
        name: i.itemName,
        description: i.description,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        lineTotalCents: i.lineTotalCents,
        discountCents: i.discountCents,
        discountLabel: i.discountCents > 0 && i.discountType === 'percent' ? formatBp(i.discountValue) : null,
        netTotalCents: i.netTotalCents,
      })),
    })),
    totals: {
      itemDiscountsCents: q.itemDiscountsCents,
      subtotalCents: q.subtotalCents,
      discountLabel: q.discountCents > 0 ? `Discount${q.discountType === 'percent' ? ` ${formatBp(q.discountValue)}` : ''}` : null,
      discountCents: q.discountCents,
      taxLabel: q.taxRateBp > 0 || q.taxCents > 0 ? `${q.taxLabel} ${formatBp(q.taxRateBp)}` : null,
      taxCents: q.taxCents,
      totalCents: q.totalCents,
      depositLabel:
        q.depositType !== 'none' && q.depositRequiredCents > 0 ? `Deposit required${q.depositType === 'percent' ? ` (${formatBp(q.depositValue)})` : ''}` : null,
      depositRequiredCents: q.depositRequiredCents,
    },
    notes: q.notes,
    terms: lines(q.terms),
    response,
  };
}
