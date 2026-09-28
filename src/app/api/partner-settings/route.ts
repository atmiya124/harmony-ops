import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { partnerSettings } from '@/lib/db/schema';
import { withPartner } from '@/lib/auth/session';

async function handleGET() {
  try {
    const [row] = await db.select().from(partnerSettings).limit(1);
    if (!row) return NextResponse.json({ companyName: '', partnerEmails: [] });
    const partnerEmails = [row.partnerEmail1, row.partnerEmail2, row.partnerEmail3, row.partnerEmail4].filter(
      (e): e is string => Boolean(e && e.trim()),
    );
    return NextResponse.json({ companyName: row.companyName || '', partnerEmails });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export const GET = withPartner(handleGET);
