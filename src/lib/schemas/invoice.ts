import { z } from 'zod';
import { INVOICE_STATUSES } from '../sales/types';
import { quoteItemInputSchema } from './quote';

// Invoices are read-only in Phase 1. Their line items take exactly the same
// shape as a quote's, so Phase 4 can copy an accepted quote across as-is.
export const invoiceItemInputSchema = quoteItemInputSchema;
export type InvoiceItemInput = z.output<typeof invoiceItemInputSchema>;

export const invoiceListQuerySchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  quoteId: z.uuid().optional(),
});
export type InvoiceListQuery = z.output<typeof invoiceListQuerySchema>;
