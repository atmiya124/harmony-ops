import { z } from 'zod';
import { MAX_AMOUNT_CENTS } from '../finance/types';
import { INVOICE_PAYMENT_METHODS, INVOICE_STATUSES } from '../sales/types';
import { clientPoNumberSchema, quoteItemInputSchema } from './quote';
import { isCalendarDate } from './finance';

// An invoice's line items take exactly the same shape as a quote's, so an
// accepted quote is copied across as-is.
export const invoiceItemInputSchema = quoteItemInputSchema;
export type InvoiceItemInput = z.output<typeof invoiceItemInputSchema>;

export const invoiceListQuerySchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  quoteId: z.uuid().optional(),
});
export type InvoiceListQuery = z.output<typeof invoiceListQuerySchema>;

const calendarDate = (message: string) => z.string(message).refine(isCalendarDate, message);
const paymentMethod = z.enum(INVOICE_PAYMENT_METHODS, 'Choose how it was paid');
const MAX_REFERENCE = 200;

// Converting an accepted quote. Everything else is copied from the quote on
// the server; only these choices come from the request. `invoiceId` is
// generated in the browser so a retried request returns the same invoice.
export const quoteConvertSchema = z.object({
  invoiceId: z.uuid('Invalid invoice id'),
  expectedUpdatedAt: z.string().min(1, 'Missing version'),
  dueDate: calendarDate('Enter a valid due date'),
  // The deposit the client has already paid, if any (0 = none yet), and
  // how and when it came in; recorded as the invoice's first payment.
  depositPaidCents: z
    .number('Enter the deposit received')
    .int('Deposit must be in whole cents')
    .min(0, "Deposit can't be negative")
    .max(MAX_AMOUNT_CENTS, "Deposit can't exceed $1,000,000"),
  depositMethod: paymentMethod.nullable().default(null),
  depositReceivedOn: calendarDate('Enter a valid date').nullable().default(null),
  // Omitted = the quote's. Often the PO only arrives once the quote is accepted.
  clientPoNumber: clientPoNumberSchema.optional(),
});
export type QuoteConvertInput = z.output<typeof quoteConvertSchema>;

// Adding or changing the client's PO number on an invoice already made.
export const invoicePoSchema = z.object({
  expectedUpdatedAt: z.string().min(1, 'Missing version'),
  clientPoNumber: clientPoNumberSchema,
});
export type InvoicePoInput = z.output<typeof invoicePoSchema>;

// Recording money received. `paymentId` is generated in the browser so a
// retried request records it once. A receipt is emailed only if asked.
export const invoicePaymentSchema = z.object({
  paymentId: z.uuid('Invalid payment id'),
  expectedUpdatedAt: z.string().min(1, 'Missing version'),
  amountCents: z.number('Enter the amount received').int('Amount must be in whole cents').min(1, 'Amount must be more than $0').max(MAX_AMOUNT_CENTS, "Amount can't exceed $1,000,000"),
  method: paymentMethod,
  receivedOn: calendarDate('Enter a valid date'),
  reference: z
    .string()
    .trim()
    .max(MAX_REFERENCE, `Keep it under ${MAX_REFERENCE} characters`)
    .nullish()
    .transform((v) => (v ? v : null)),
  sendReceipt: z.boolean().default(false),
});
export type InvoicePaymentInput = z.output<typeof invoicePaymentSchema>;

// Undoing a payment recorded by mistake.
export const voidPaymentSchema = z.object({
  expectedUpdatedAt: z.string().min(1, 'Missing version'),
  reason: z
    .string()
    .trim()
    .max(MAX_REFERENCE, `Keep it under ${MAX_REFERENCE} characters`)
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type VoidPaymentInput = z.output<typeof voidPaymentSchema>;

