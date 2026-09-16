import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { equipmentCatalog } from '@/lib/db/schema';

export async function GET() {
  try {
    const rows = await db.select().from(equipmentCatalog);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
