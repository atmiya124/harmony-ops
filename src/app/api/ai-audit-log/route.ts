import { NextRequest, NextResponse } from 'next/server';
import { createAiExtractionAudit } from '@/lib/db/aiAuditRepo';
import { aiExtractionAuditInputSchema } from '@/lib/schemas/aiExtractionAudit';
import { formatZodError } from '@/lib/schemas/formatZodError';

// Background audit trail for the "paste email to pre-fill" flow — no UI
// reads this. Never blocks or fails the booking save itself: the client
// calls this only after the booking already exists, and fire-and-forgets
// the result.
export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const result = aiExtractionAuditInputSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 });
    }
    await createAiExtractionAudit(result.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
