import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { listInvoices } from '@/lib/db/invoiceRepo';
import { invoiceListQuerySchema } from '@/lib/schemas/invoice';
import { badRequest, financeErrorResponse } from '@/lib/api/financeHttp';

// Invoices are created from an accepted quote: POST /api/quotes/[id]/invoice.
export const GET = withPartner(async (req) => {
  const parsed = invoiceListQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid filter');
  try {
    return NextResponse.json(await listInvoices(parsed.data));
  } catch (err) {
    return financeErrorResponse(err, 'list invoices');
  }
});
