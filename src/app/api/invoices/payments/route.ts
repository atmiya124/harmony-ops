import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { listReceivedPayments } from '@/lib/db/invoicePaymentRepo';
import { financeErrorResponse } from '@/lib/api/financeHttp';

// Every payment received (not undone), for the Finances screen.
export const GET = withPartner(async () => {
  try {
    return NextResponse.json(await listReceivedPayments());
  } catch (err) {
    return financeErrorResponse(err, 'list payments');
  }
});
