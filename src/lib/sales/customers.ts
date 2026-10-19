// The Customers list, derived from saved quotes — there is no customer table
// yet. One customer per email address (or, without one, per name), with the
// contact details from their most recent quote. A future customer profile
// module would replace this, and could carry the client type too.
import type { QuoteClientType, QuoteStatus } from './types';

export interface CustomerQuoteRef {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  quoteDate: string;
  eventName: string | null;
  totalCents: number;
}

export interface CustomerSource extends CustomerQuoteRef {
  customerName: string;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  clientType: QuoteClientType;
}

export interface CustomerDto {
  key: string; // stable id for the list: email, else name
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  clientType: QuoteClientType; // from the latest quote
  lastQuoteDate: string;
  quotes: CustomerQuoteRef[]; // newest first
}

const squash = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function customerKey(q: Pick<CustomerSource, 'customerEmail' | 'customerName'>): string {
  const email = q.customerEmail?.trim().toLowerCase();
  return email ? `email:${email}` : `name:${squash(q.customerName)}`;
}

// Newest quote first decides the shown details; customers sorted by name.
export function groupCustomers(quotes: readonly CustomerSource[]): CustomerDto[] {
  const newestFirst = [...quotes].sort((a, b) => b.quoteDate.localeCompare(a.quoteDate) || b.quoteNumber.localeCompare(a.quoteNumber));
  const byKey = new Map<string, CustomerDto>();
  for (const q of newestFirst) {
    const key = customerKey(q);
    const ref: CustomerQuoteRef = { id: q.id, quoteNumber: q.quoteNumber, status: q.status, quoteDate: q.quoteDate, eventName: q.eventName, totalCents: q.totalCents };
    const existing = byKey.get(key);
    if (existing) {
      existing.quotes.push(ref);
      // Fill gaps from older quotes (e.g. a phone only given the first time).
      existing.company ??= q.customerCompany;
      existing.email ??= q.customerEmail;
      existing.phone ??= q.customerPhone;
      continue;
    }
    byKey.set(key, {
      key,
      name: q.customerName.trim().replace(/\s+/g, ' '),
      company: q.customerCompany,
      email: q.customerEmail,
      phone: q.customerPhone,
      clientType: q.clientType,
      lastQuoteDate: q.quoteDate,
      quotes: [ref],
    });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
