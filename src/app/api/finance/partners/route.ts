import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { listPartners, outstandingReimbursements } from '@/lib/db/financeRepo';
import { financeErrorResponse } from '@/lib/api/financeHttp';

// The four partners (for "Paid by"), which one is signed in (preselected),
// and what the company currently owes each of them.
export const GET = withPartner(async (_req, { partner }) => {
  try {
    const [partners, owed] = await Promise.all([listPartners(), outstandingReimbursements()]);
    const owedBy = new Map(owed.map((o) => [o.paidByEmail, o.outstandingCents]));
    return NextResponse.json({
      me: partner.email.toLowerCase(),
      partners: partners.map((p) => ({ ...p, outstandingCents: owedBy.get(p.email) ?? 0 })),
    });
  } catch (err) {
    return financeErrorResponse(err, 'list partners');
  }
});
