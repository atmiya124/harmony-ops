import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveEquipmentLine } from '@/lib/equipmentCatalog';
import { AiParsedBooking } from '@/lib/aiParse';

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You extract structured event-booking data from a pasted client email or chat message for an AV/LED-wall/stage rental company.

Return ONLY a single JSON object — no markdown fences, no preamble, no commentary — matching exactly this shape:

{
  "client": { "name": string, "email": string, "phone": string },
  "schedule": {
    "eventDate": string,    // YYYY-MM-DD, the main event date
    "setupTime": string,    // HH:MM 24h, when crew arrives
    "startTime": string,    // HH:MM 24h, event start
    "endTime": string,      // HH:MM 24h, event end
    "pickupDate": string,   // YYYY-MM-DD, equipment pickup date (often the day after)
    "pickupTime": string    // HH:MM 24h
  },
  "venue": { "eventType": string, "location": string },
  "equipment": [
    { "itemName": string, "spec": string, "qty": number, "confidence": "confirmed" | "assumed" | "missing" }
  ],
  "services": [
    { "name": string, "confidence": "confirmed" | "assumed" | "missing" }
  ],
  "notes": string,   // anything that is NOT a scheduling field — quote deadlines, special
                      // requests, pricing complaints, etc. NEVER put a response deadline
                      // like "need this by Monday" into any date field — it belongs here.
  "confidence": {
    // one entry per scalar field above, dot-path keyed:
    // "client.name", "client.email", "client.phone",
    // "schedule.eventDate", "schedule.setupTime", "schedule.startTime", "schedule.endTime",
    // "schedule.pickupDate", "schedule.pickupTime",
    // "venue.eventType", "venue.location"
    "<fieldPath>": "confirmed" | "assumed" | "missing"
  }
}

Confidence rules:
- "confirmed": the message states this unambiguously.
- "assumed": you had to infer something (e.g. assumed the year, assumed feet vs meters, guessed pickup date from context).
- "missing": the message does not mention this at all. Use "" (empty string) or [] as the value.

For equipment "spec", extract size/dimension text as stated (e.g. "8x14ft") — do not resolve it to a catalog spec yourself, that happens downstream.
For "eventType" pick the closest of: Wedding, Quinceañera, Birthday Party, Corporate, Sweet 16, Graduation, Anniversary, Other.
Never guess a client email or phone number that is not present in the text — mark those "missing" instead.
Output must be valid JSON and nothing else.`;

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function isNearEmpty(parsed: AiParsedBooking): boolean {
  const hasClient = parsed.client?.name || parsed.client?.email || parsed.client?.phone;
  const hasSchedule = parsed.schedule?.eventDate;
  const hasVenue = parsed.venue?.location;
  const hasEquipment = (parsed.equipment ?? []).length > 0;
  const hasNotes = (parsed.notes ?? '').trim().length > 0;
  return !hasClient && !hasSchedule && !hasVenue && !hasEquipment && !hasNotes;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text || '').trim();
  if (!text) {
    return NextResponse.json({ error: 'Missing "text" to parse.' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  let message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Anthropic API request failed: ${detail}` }, { status: 502 });
  }

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'No text content returned by the model.' }, { status: 502 });
  }

  let parsed: AiParsedBooking;
  try {
    parsed = JSON.parse(stripFences(textBlock.text));
  } catch {
    return NextResponse.json(
      { error: "Could not make sense of that text — the model's response wasn't valid JSON. Try the manual form instead." },
      { status: 422 },
    );
  }

  if (isNearEmpty(parsed)) {
    return NextResponse.json(
      { error: 'Nothing usable could be extracted from that text. Try the manual form instead.' },
      { status: 422 },
    );
  }

  // Defensive backfill so the client always gets a complete shape.
  parsed.client = parsed.client ?? { name: '', email: '', phone: '' };
  parsed.schedule = parsed.schedule ?? { eventDate: '', setupTime: '', startTime: '', endTime: '', pickupDate: '', pickupTime: '' };
  parsed.venue = parsed.venue ?? { eventType: '', location: '' };
  parsed.equipment = parsed.equipment ?? [];
  parsed.services = parsed.services ?? [];
  parsed.notes = parsed.notes ?? '';
  parsed.confidence = parsed.confidence ?? {};

  // Cross-reference every equipment line against the catalog, running the
  // real LED/stage calculator math when it resolves to a panel spec. If
  // the catalog lookup itself fails (e.g. DB unreachable), degrade to
  // unresolved lines rather than failing the whole draft.
  try {
    parsed.equipment = await Promise.all(
      parsed.equipment.map(async (item) => {
        const resolved = await resolveEquipmentLine(item.itemName || '', item.spec || '', item.qty || 1, item.confidence || 'assumed');
        return { itemName: resolved.itemName, spec: resolved.spec, qty: resolved.qty, confidence: resolved.confidence };
      }),
    );
  } catch {
    parsed.equipment = parsed.equipment.map((item) => ({
      ...item,
      confidence: item.confidence === 'missing' ? 'missing' : 'assumed',
    }));
  }

  return NextResponse.json(parsed);
}
