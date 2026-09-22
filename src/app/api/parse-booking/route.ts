import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveEquipmentLine } from '@/lib/equipmentCatalog';
import { aiParsedBookingSchema, AiParsedBookingParsed } from '@/lib/schemas/aiParsedBooking';
import { AI_EXTRACTION_MODEL } from '@/lib/aiModel';
import { ALL_SERVICES } from '@/lib/bookingTypes';

const MODEL = AI_EXTRACTION_MODEL;

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
  ],   // "name" MUST be copied verbatim from the allowed list below — see the Services rule
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

Services rule: "services" is a checklist, not free text. Only ever use names copied
verbatim from this exact list — never invent a new name, never paraphrase one:
${ALL_SERVICES.join(', ')}
Include a service whenever the message implies it, even loosely — e.g. "sound" or
"audio" implies "Sound System", "a stage" or "platform" implies "Stage", "screen and
projector" implies "Projector & Screen". A big LED video wall/screen is equipment
(goes in "equipment"), not "LED Backdrop" — only use "LED Backdrop" when the message
specifically describes a backdrop-style LED panel (e.g. behind a step-and-repeat).
If nothing in the message matches an item on the list, "services" is an empty array —
do not fill it with anything not on the list.

Output must be valid JSON and nothing else.`;

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function isNearEmpty(parsed: AiParsedBookingParsed): boolean {
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

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(stripFences(textBlock.text));
  } catch {
    return NextResponse.json(
      { error: "Could not make sense of that text — the model's response wasn't valid JSON. Try the manual form instead." },
      { status: 422 },
    );
  }

  // Validates shape/types and fills in any field the model omitted — a
  // structurally broken response (wrong types, garbage nesting) fails here
  // with a clean 422 instead of corrupting a booking draft downstream.
  const schemaResult = aiParsedBookingSchema.safeParse(rawParsed);
  if (!schemaResult.success) {
    return NextResponse.json(
      { error: "Could not make sense of that text — the model's response didn't match the expected shape. Try the manual form instead." },
      { status: 422 },
    );
  }
  const parsed = schemaResult.data;

  // Services is a fixed checklist (matches the manual form's Step 5) — drop
  // anything the model returned that isn't an exact match, rather than
  // trusting prompt compliance alone.
  const allowedServices = new Set<string>(ALL_SERVICES);
  parsed.services = parsed.services.filter((s) => allowedServices.has(s.name));

  if (isNearEmpty(parsed)) {
    return NextResponse.json(
      { error: 'Nothing usable could be extracted from that text. Try the manual form instead.' },
      { status: 422 },
    );
  }

  // Cross-reference every equipment line against the catalog, running the
  // real LED/stage calculator math when it resolves to a panel spec. If
  // the catalog lookup itself fails (e.g. DB unreachable), degrade to
  // unresolved lines rather than failing the whole draft.
  try {
    parsed.equipment = await Promise.all(
      parsed.equipment.map(async (item) => {
        const resolved = await resolveEquipmentLine(item.itemName, item.spec, item.qty, item.confidence);
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
