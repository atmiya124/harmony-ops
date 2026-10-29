// Browser-side calls to the quotes and invoices API. Only inputs are sent:
// the server assigns numbers and status and recalculates every total.
import type { QuoteDto, QuoteItemDto, QuoteListItemDto, QuoteSummaryDto } from './db/quoteRepo';
import type { InvoiceDto, InvoicePaymentDto, InvoiceSummaryDto } from './db/invoiceRepo';
import type { ReceivedPaymentDto } from './db/invoicePaymentRepo';
import type { CustomerDto } from './sales/customers';
import type { AdjustmentType, InvoicePaymentMethod, QuoteClientType, QuotePaymentMethod, QuoteStatus } from './sales/types';
import { invalidateCache, setCache } from './clientCache';
import { json, request } from './apiClient';

export type { CustomerDto, InvoiceDto, InvoicePaymentDto, InvoiceSummaryDto, QuoteDto, QuoteItemDto, QuoteListItemDto, QuoteSummaryDto, ReceivedPaymentDto };

// Cache keys (see clientCache). A saved quote replaces its cached copy and
// clears the cached list, so going back never shows the old version.
export const QUOTES_KEY = 'quotes:list';
export const quoteKey = (id: string) => `quotes:detail:${id}`;
export const INVOICES_KEY = 'invoices:list';
export const invoiceKey = (id: string) => `invoices:detail:${id}`;
// Derived from quotes, so any quote change clears it too.
export const CUSTOMERS_KEY = 'customers:list';

function saved(result: Promise<QuoteDto>): Promise<QuoteDto> {
  return result.then((quote) => {
    invalidateCache(QUOTES_KEY, CUSTOMERS_KEY);
    setCache(quoteKey(quote.id), quote);
    return quote;
  });
}

export interface QuoteItemValues {
  id?: string;
  section: string;
  itemName: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  discountType: AdjustmentType; // this line only
  discountValue: number;
}

export interface QuoteFormValues {
  customerName: string;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  billingAddress: string | null;
  eventId: number | null;
  eventName: string | null;
  eventDate: string | null;
  venueName: string | null;
  venueAddress: string | null;
  quoteDate: string;
  validUntil: string;
  clientPoNumber: string | null;
  items: QuoteItemValues[];
  discountType: AdjustmentType;
  discountValue: number;
  taxLabel: string;
  taxRateBp: number;
  depositType: AdjustmentType;
  depositValue: number;
  notes: string | null;
  clientType: QuoteClientType;
  terms: string | null;
  showPaymentDetails: boolean;
  paymentMethod: QuotePaymentMethod | null;
}

export function listQuotes(): Promise<QuoteListItemDto[]> {
  return request('/api/quotes');
}

export function getQuote(id: string): Promise<QuoteDto> {
  return request<QuoteDto>(`/api/quotes/${id}`).then((quote) => {
    setCache(quoteKey(id), quote);
    return quote;
  });
}

// `id` is generated once per new quote, so a retried save can't create two.
export function createQuote(id: string, values: QuoteFormValues): Promise<QuoteDto> {
  return saved(request('/api/quotes', json('POST', { id, ...values })));
}

export function updateQuote(id: string, values: QuoteFormValues, expectedUpdatedAt: string): Promise<QuoteDto> {
  return saved(request(`/api/quotes/${id}`, json('PATCH', { ...values, expectedUpdatedAt })));
}

export function setQuoteStatus(id: string, status: QuoteStatus, expectedUpdatedAt: string): Promise<QuoteDto> {
  return saved(request(`/api/quotes/${id}/status`, json('POST', { status, expectedUpdatedAt })));
}

// Emails the quote to the client (link + PDF). `sendId` is made once per
// click so a retried request sends only one email.
export function sendQuote(id: string, expectedUpdatedAt: string, sendId: string): Promise<QuoteDto> {
  return saved(request(`/api/quotes/${id}/send`, json('POST', { expectedUpdatedAt, sendId })));
}

// A new draft copied from this quote; `newId` makes a retry return the same copy.
export function cloneQuote(id: string, newId: string): Promise<QuoteDto> {
  return saved(request(`/api/quotes/${id}/clone`, json('POST', { id: newId })));
}

export async function deleteQuote(id: string, expectedUpdatedAt: string): Promise<void> {
  await request(`/api/quotes/${id}`, json('DELETE', { expectedUpdatedAt }));
  invalidateCache(QUOTES_KEY, CUSTOMERS_KEY);
  invalidateCache(quoteKey(id));
}

// Recovery: creates the booking for a client-accepted quote whose automatic
// booking didn't happen. Safe to repeat — it never makes a second booking.
export function createBookingFromQuote(id: string): Promise<QuoteDto> {
  return saved(request(`/api/quotes/${id}/booking`, { method: 'POST' }));
}

// Makes the invoice for an accepted quote and marks the quote Converted.
// `invoiceId` is made once per dialog so a retry can't create two.
export function convertQuoteToInvoice(id: string, values: { invoiceId: string; expectedUpdatedAt: string; dueDate: string; depositPaidCents: number; depositMethod: InvoicePaymentMethod | null; depositReceivedOn: string | null; clientPoNumber: string | null }): Promise<QuoteDto> {
  return saved(request<QuoteDto>(`/api/quotes/${id}/invoice`, json('POST', values))).then((quote) => {
    invalidateCache(INVOICES_KEY, PAYMENTS_KEY);
    return quote;
  });
}

export function listInvoices(): Promise<InvoiceSummaryDto[]> {
  return request('/api/invoices');
}

export function getInvoice(id: string): Promise<InvoiceDto> {
  return request<InvoiceDto>(`/api/invoices/${id}`).then((invoice) => {
    setCache(invoiceKey(id), invoice);
    return invoice;
  });
}

// A changed invoice replaces its cached copy and clears the lists built from
// invoices (and quotes, which show their invoice's status).
function invoiceSaved(invoice: InvoiceDto): InvoiceDto {
  invalidateCache(INVOICES_KEY, PAYMENTS_KEY, QUOTES_KEY);
  if (invoice.quoteId) invalidateCache(quoteKey(invoice.quoteId));
  setCache(invoiceKey(invoice.id), invoice);
  return invoice;
}

export interface PaymentValues {
  paymentId: string; // made once per dialog, so a retry records it once
  amountCents: number;
  method: InvoicePaymentMethod;
  receivedOn: string;
  reference: string | null;
  sendReceipt: boolean;
}

// The receipt's outcome when one was asked for: the payment is saved either way.
export type ReceiptOutcome = { sent: true; to: string } | { sent: false; error: string } | null;

export async function recordPayment(invoiceId: string, values: PaymentValues, expectedUpdatedAt: string): Promise<{ invoice: InvoiceDto; receipt: ReceiptOutcome }> {
  const result = await request<{ invoice: InvoiceDto; receipt: ReceiptOutcome }>(`/api/invoices/${invoiceId}/payments`, json('POST', { ...values, expectedUpdatedAt }));
  return { invoice: invoiceSaved(result.invoice), receipt: result.receipt };
}

export async function undoPayment(invoiceId: string, paymentId: string, reason: string | null, expectedUpdatedAt: string): Promise<InvoiceDto> {
  return invoiceSaved(await request<InvoiceDto>(`/api/invoices/${invoiceId}/payments/${paymentId}/void`, json('POST', { reason, expectedUpdatedAt })));
}

export async function updateInvoicePo(invoiceId: string, clientPoNumber: string | null, expectedUpdatedAt: string): Promise<InvoiceDto> {
  return invoiceSaved(await request<InvoiceDto>(`/api/invoices/${invoiceId}`, json('PATCH', { clientPoNumber, expectedUpdatedAt })));
}

// `sendId` is made once per click, so a retried request sends one email.
export async function sendReceipt(invoiceId: string, paymentId: string, sendId: string): Promise<InvoiceDto> {
  return invoiceSaved(await request<InvoiceDto>(`/api/invoices/${invoiceId}/payments/${paymentId}/receipt`, json('POST', { sendId })));
}

// Every payment received, for Finances.
export const PAYMENTS_KEY = 'invoices:payments';
export function listPayments(): Promise<ReceivedPaymentDto[]> {
  return request('/api/invoices/payments');
}

// ---------------------------------------------------------------------------
// Client link (Phase 3)
// ---------------------------------------------------------------------------

export type { ClientResponseDto, StaffClientLinkDto } from './db/clientLinkRepo';
import type { ClientResponseDto, StaffClientLinkDto } from './db/clientLinkRepo';

export interface ClientLinkState {
  link: StaffClientLinkDto | null;
  responses: ClientResponseDto[];
}

export function getClientLink(quoteId: string): Promise<ClientLinkState> {
  return request(`/api/quotes/${quoteId}/client-link`);
}

// Creates a link, or replaces the current one (the old link stops working).
// Sharing a draft marks it Sent, so the cached quote is refreshed too.
export function createClientLink(quoteId: string): Promise<ClientLinkState> {
  return request<ClientLinkState>(`/api/quotes/${quoteId}/client-link`, { method: 'POST' }).then((state) => {
    invalidateCache(QUOTES_KEY, CUSTOMERS_KEY);
    return state;
  });
}

export function revokeClientLink(quoteId: string): Promise<ClientLinkState> {
  return request(`/api/quotes/${quoteId}/client-link`, { method: 'DELETE' });
}

// Customers, derived from saved quotes (see sales/customers).

export function listCustomers(): Promise<CustomerDto[]> {
  return request('/api/customers');
}
