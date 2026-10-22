import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { unpaidOneOffs } from '@/lib/db/labourRepo';
import { financeErrorResponse } from '@/lib/api/financeHttp';

// One-off crew (not on the crew list) who are still owed money.
export const GET = withPartner(async () => {
  try {
    return NextResponse.json(await unpaidOneOffs());
  } catch (err) {
    return financeErrorResponse(err, 'list one-off crew');
  }
});
