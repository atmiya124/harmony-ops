import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { listCustomers } from '@/lib/db/quoteRepo';
import { financeErrorResponse } from '@/lib/api/financeHttp';

// Customers as found on saved quotes, sorted by name.
export const GET = withPartner(async () => {
  try {
    return NextResponse.json(await listCustomers());
  } catch (err) {
    return financeErrorResponse(err, 'list customers');
  }
});
