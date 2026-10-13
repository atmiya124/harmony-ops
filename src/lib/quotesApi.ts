// Browser-side calls to the quotes and invoices API. Only inputs are sent:
// the server assigns numbers and status and recalculates every total.
import type { QuoteDto, QuoteSummaryDto } from './db/quoteRepo';
import type { InvoiceSummaryDto } from './db/invoiceRepo';
import type { AdjustmentType, QuoteStatus } from './sales/types';
import { invalidateCache, setCache } from './clientCache';
import { json, request } from './apiClient';

export type { InvoiceSummaryDto, QuoteDto, QuoteSummaryDto };

// Cache keys (see clientCache). A saved quote replaces its cached copy and
// clears the cached list, so going back never shows the old version.
export const QUOTES_KEY = 'quotes:list';
export const quoteKey = (id: string) => `quotes:detail:${id}`;
export const INVOICES_KEY = 'invoices:list';

function saved(result: Promise<QuoteDto>): Promise<QuoteDto> {
  return result.then((quote) => {
    invalidateCache(QUOTES_KEY);
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
  items: QuoteItemValues[];
  discountType: AdjustmentType;
  discountValue: number;
  taxLabel: string;
  taxRateBp: number;
  depositType: AdjustmentType;
  depositValue: number;
  notes: string | null;
  terms: string | null;
  showPaymentDetails: boolean;
}

export function listQuotes(): Promise<QuoteSummaryDto[]> {
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

export function listInvoices(): Promise<InvoiceSummaryDto[]> {
  return request('/api/invoices');
}
