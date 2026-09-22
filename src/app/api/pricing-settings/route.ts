import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { pricingSettings } from '@/lib/db/schema';
import { DEFAULT_LED_RATE } from '@/lib/ledCalculator';
import { DEFAULT_STAGE_RATE } from '@/lib/stageCalculator';
import { pricingSettingsInputSchema } from '@/lib/schemas/pricingSettings';
import { formatZodError } from '@/lib/schemas/formatZodError';

export async function GET() {
  try {
    const [row] = await db.select().from(pricingSettings).limit(1);
    if (!row) return NextResponse.json({ ledPricePerSqft: DEFAULT_LED_RATE, stagePricePerPanel: DEFAULT_STAGE_RATE });
    return NextResponse.json({ ledPricePerSqft: row.ledPricePerSqft, stagePricePerPanel: row.stagePricePerPanel });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const result = pricingSettingsInputSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 });
    }
    const { ledPricePerSqft, stagePricePerPanel } = result.data;

    const [existing] = await db.select().from(pricingSettings).limit(1);
    const updatedAt = new Date().toISOString();
    if (existing) {
      await db.update(pricingSettings).set({ ledPricePerSqft, stagePricePerPanel, updatedAt }).where(eq(pricingSettings.id, existing.id));
    } else {
      await db.insert(pricingSettings).values({ ledPricePerSqft, stagePricePerPanel, updatedAt });
    }

    return NextResponse.json({ ledPricePerSqft, stagePricePerPanel });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
