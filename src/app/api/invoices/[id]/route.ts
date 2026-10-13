import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { getInvoice } from '@/lib/db/invoiceRepo';
import { financeErrorResponse } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

const notFound = () => NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  try {
    const invoice = await getInvoice(id);
    return invoice ? NextResponse.json(invoice) : notFound();
  } catch (err) {
    return financeErrorResponse(err, 'load invoice');
  }
});
