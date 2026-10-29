// Test data for the document tests (not used by the app). Stored totals are
// produced by the real calculator, exactly as the server saves them.
import { randomUUID } from 'node:crypto';
import type { QuoteDto, QuoteItemDto } from '../db/quoteRepo';
import type { InvoiceDto } from '../db/invoiceRepo';
import { calculateQuoteTotals } from '../quoteCalculator';
import type { AdjustmentType } from '../sales/types';
import { DOCUMENT_CONFIG, type DocumentConfig } from '../sales/documentConfig';

// Clearly-fake contact details, to see a fully filled header and footer.
export const SAMPLE_CONFIG: DocumentConfig = {
  ...DOCUMENT_CONFIG,
  addressLines: ['100 Example Street', 'Toronto, ON  M5V 0A0'],
  phones: ['+1 (416) 555-0100', '+1 (416) 555-0199'],
  businessHours: 'Monday to Saturday 9:00am to 6:00pm',
  email: 'info@example.com',
  website: 'www.example.com',
  payment: { ...DOCUMENT_CONFIG.payment, etransferEmail: 'payments@example.com' },
};

// Every optional company detail unset: the PDF must simply leave them off.
export const BLANK_CONFIG: DocumentConfig = {
  ...DOCUMENT_CONFIG,
  addressLines: [],
  phones: [],
  businessHours: null,
  email: null,
  website: null,
  payment: { ...DOCUMENT_CONFIG.payment, etransferEmail: null, bank: null },
};

export interface FixtureItem {
  section: string;
  itemName: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: number;
  discountType?: AdjustmentType;
  discountValue?: number;
}

// The line items of the Harmony Production reference quote (Q-000000218).
export const REFERENCE_ITEMS: FixtureItem[] = [
  { section: 'LED Display', itemName: 'Outdoor LED Wall P3.9', description: '12 ft x 8 ft modular screen with processor, rigging and on-site technician.', quantity: 1, unitPriceCents: 240000 },
  { section: 'LED Display', itemName: 'Indoor LED Wall P2.6', description: '10 ft x 6 ft stage backdrop screen for visuals and live camera feed.', quantity: 1, unitPriceCents: 160000 },
  { section: 'LED Display', itemName: '65" LED TV on stand', quantity: 4, unitPriceCents: 15000 },
  { section: 'LED Display', itemName: 'Video Switcher & Playback', description: 'Multi-input switcher, media server and operator for the event.', quantity: 1, unitPriceCents: 65000 },
  { section: 'Sound', itemName: 'Line Array PA System', description: 'Main left/right arrays with subwoofers, sized for up to 800 guests.', quantity: 1, unitPriceCents: 220000 },
  { section: 'Sound', itemName: 'Digital Mixing Console', quantity: 1, unitPriceCents: 45000 },
  { section: 'Sound', itemName: 'Wireless Microphones', quantity: 6, unitPriceCents: 6000 },
  { section: 'Sound', itemName: 'Stage Monitor Speakers', quantity: 4, unitPriceCents: 8000 },
  { section: 'Sound', itemName: 'DJ Booth Setup', description: 'Branded booth facade, CDJs, mixer and dedicated monitor speakers.', quantity: 1, unitPriceCents: 55000 },
  { section: 'Stage', itemName: 'Main Stage Platform', description: '24 ft x 16 ft modular stage, 3 ft high, with skirting and stairs.', quantity: 1, unitPriceCents: 180000 },
  { section: 'Stage', itemName: 'Truss Structure', description: 'Front and side truss for lighting, LED wall and banner rigging.', quantity: 1, unitPriceCents: 125000 },
  { section: 'Stage', itemName: 'Stage Carpet & Skirting', quantity: 1, unitPriceCents: 30000 },
  { section: 'Stage', itemName: 'Crowd Barricades', quantity: 10, unitPriceCents: 3500 },
  { section: 'Lights', itemName: 'Moving Head Lights', description: 'Beam and spot fixtures programmed to the event run-of-show.', quantity: 12, unitPriceCents: 7500 },
  { section: 'Lights', itemName: 'LED Par Uplights', quantity: 24, unitPriceCents: 2000 },
  { section: 'Lights', itemName: 'Haze Machine', quantity: 2, unitPriceCents: 9000 },
  { section: 'Lights', itemName: 'Lighting Console & Operator', description: 'Show programming, cue control and operator for the full event.', quantity: 1, unitPriceCents: 60000 },
  { section: 'Services', itemName: 'Setup & Teardown Crew', quantity: 1, unitPriceCents: 90000 },
  { section: 'Services', itemName: 'Transport & Delivery', quantity: 1, unitPriceCents: 35000 },
];

export const REFERENCE_TERMS = [
  'A 50% non-refundable deposit is required to confirm the booking. The remaining balance is due 3 days before the event date.',
  'Prices quoted are valid for 30 days from the quote date and are subject to equipment availability at the time of booking.',
  'The client is responsible for providing safe venue access, an adequate power supply and any permits required by the venue.',
  'Cancellations made less than 14 days before the event will be charged 50% of the total quoted amount.',
  'Any damage to equipment caused by guests or venue staff will be charged to the client at repair or replacement cost.',
].join('\n');

export interface QuoteFixtureOptions {
  items?: FixtureItem[];
  discountType?: AdjustmentType;
  discountValue?: number;
  taxRateBp?: number;
  depositType?: AdjustmentType;
  depositValue?: number;
  overrides?: Partial<QuoteDto>;
}

export function quoteFixture(o: QuoteFixtureOptions = {}): QuoteDto {
  const items = o.items ?? REFERENCE_ITEMS;
  const discountType = o.discountType ?? 'percent';
  const discountValue = o.discountValue ?? (discountType === 'none' ? 0 : 500);
  const depositType = o.depositType ?? 'percent';
  const depositValue = o.depositValue ?? (depositType === 'none' ? 0 : 5000);
  const taxRateBp = o.taxRateBp ?? 1300;
  const t = calculateQuoteTotals({
    items: items.map((i) => ({ quantity: i.quantity, unitPriceCents: i.unitPriceCents, discount: { type: i.discountType ?? 'none', value: i.discountValue ?? 0 } })),
    discount: { type: discountType, value: discountValue },
    taxRateBp,
    deposit: { type: depositType, value: depositValue },
  });
  const dtoItems: QuoteItemDto[] = items.map((i, n) => ({
    id: randomUUID(),
    section: i.section,
    itemName: i.itemName,
    description: i.description ?? null,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    lineTotalCents: t.lineTotalsCents[n],
    discountType: i.discountType ?? 'none',
    discountValue: i.discountValue ?? 0,
    discountCents: t.lineDiscountsCents[n],
    netTotalCents: t.lineNetCents[n],
    sortOrder: n,
  }));
  return {
    id: randomUUID(),
    quoteNumber: 'Q-000000218',
    status: 'sent',
    customerName: 'Michael Smith',
    customerCompany: null,
    customerEmail: 'michael.smith@contact.com',
    customerPhone: '+1 132 456 7800',
    billingAddress: '220 West 53rd Street, New York, NY 10019, USA',
    eventId: null,
    event: null,
    eventDeleted: false,
    eventName: 'Smith Corporate Gala',
    eventDate: '2026-10-17',
    venueName: null,
    venueAddress: null,
    clientPoNumber: null,
    quoteDate: '2026-10-13',
    validUntil: '2026-11-12',
    currency: 'CAD',
    itemDiscountsCents: t.itemDiscountsCents,
    subtotalCents: t.subtotalCents,
    discountType,
    discountValue,
    discountCents: t.discountCents,
    taxLabel: 'HST',
    taxRateBp,
    taxCents: t.taxCents,
    totalCents: t.totalCents,
    depositType,
    depositValue,
    depositRequiredCents: t.depositRequiredCents,
    notes: null,
    clientType: 'regular',
    terms: REFERENCE_TERMS,
    showPaymentDetails: true,
    paymentMethod: null,
    statusChangedAt: null,
    sentAt: null,
    acceptedAt: '2026-10-13T15:00:00.000Z',
    createdByEmail: 'partner@example.com',
    createdByName: 'Atmiya Patel',
    updatedByEmail: 'partner@example.com',
    createdAt: '2026-10-13T14:00:00.000Z',
    updatedAt: '2026-10-13T14:00:00.000Z',
    items: dtoItems,
    invoices: [],
    emailSends: [],
    ...o.overrides,
  };
}

// An invoice copied from a quote fixture, as Phase 4 will create them.
export function invoiceFixture(quote: QuoteDto = quoteFixture(), payments: { depositPaidCents?: number; amountPaidCents?: number } = {}, overrides: Partial<InvoiceDto> = {}): InvoiceDto {
  const depositPaidCents = payments.depositPaidCents ?? quote.depositRequiredCents;
  const amountPaidCents = payments.amountPaidCents ?? 0;
  return {
    id: randomUUID(),
    invoiceNumber: 'INV-000000218',
    quoteId: quote.id,
    status: 'sent',
    customerName: quote.customerName,
    customerCompany: quote.customerCompany,
    eventName: quote.eventName,
    eventDate: quote.eventDate,
    invoiceDate: '2026-10-13',
    dueDate: '2026-10-27',
    totalCents: quote.totalCents,
    balanceDueCents: quote.totalCents - depositPaidCents - amountPaidCents,
    createdAt: '2026-10-13T16:00:00.000Z',
    updatedAt: '2026-10-13T16:00:00.000Z',
    quoteNumber: quote.quoteNumber,
    quoteAcceptedAt: quote.acceptedAt,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    billingAddress: quote.billingAddress,
    eventId: quote.eventId,
    venueName: quote.venueName,
    venueAddress: quote.venueAddress,
    clientPoNumber: quote.clientPoNumber,
    currency: 'CAD',
    subtotalCents: quote.subtotalCents,
    discountType: quote.discountType,
    discountValue: quote.discountValue,
    discountCents: quote.discountCents,
    taxLabel: quote.taxLabel,
    taxRateBp: quote.taxRateBp,
    taxCents: quote.taxCents,
    depositPaidCents,
    amountPaidCents,
    paidAt: null,
    statusChangedAt: '2026-10-13T16:00:00.000Z',
    sentAt: '2026-10-13T16:00:00.000Z',
    voidedAt: null,
    voidReason: null,
    createdByEmail: 'partner@example.com',
    notes: null,
    terms: [
      'Payment of the balance is due by the due date shown above. Please use the invoice number as your payment reference.',
      'The 50% deposit received on booking is non-refundable and has been deducted from the invoice total above.',
      'Overdue balances may be subject to a late payment charge of 2% per month until paid in full.',
      'Any damage to equipment caused by guests or venue staff will be invoiced separately at repair or replacement cost.',
      'Please notify us of any billing questions within 7 days of the invoice date.',
    ].join('\n'),
    showPaymentDetails: quote.showPaymentDetails,
    items: quote.items,
    payments: [],
    ...overrides,
  };
}
