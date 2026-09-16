import { resolveEquipmentText } from '../utils/equipmentCatalog';

// Minimal Vercel Node function signature — avoids pulling in @vercel/node
// purely for types on a single small handler.
type VercelRequest = { method?: string; body?: unknown };
type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

export type AiConfidence = 'auto' | 'review' | 'missing';

export interface AiFieldMeta {
  confidence: AiConfidence;
  note?: string;
}

export interface AiParsedEquipmentItem {
  itemName: string;
  spec: string;
  qty: number;
}

export interface AiParsedBooking {
  eventTitle: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  eventType: string;
  eventDate: string;
  setupTime: string;
  startTime: string;
  endTime: string;
  pickupDate: string;
  pickupTime: string;
  venueName: string;
  venueAddress: string;
  equipment: AiParsedEquipmentItem[];
  services: string[];
  notes: string;
  meta: Record<string, AiFieldMeta>;
}

const FIELD_KEYS = [
  'eventTitle',
  'clientName',
  'clientPhone',
  'clientEmail',
  'eventType',
  'eventDate',
  'setupTime',
  'startTime',
  'endTime',
  'pickupDate',
  'pickupTime',
  'venueName',
  'venueAddress',
  'equipment',
  'services',
  'notes',
] as const;

const SYSTEM_PROMPT = `You extract structured event-booking data from a pasted client email or inquiry for an AV/LED-wall/stage rental company.

Return ONLY a single JSON object — no markdown fences, no commentary — matching exactly this shape:

{
  "eventTitle": string,
  "clientName": string,
  "clientPhone": string,
  "clientEmail": string,
  "eventType": string,
  "eventDate": string,        // YYYY-MM-DD, the main event date
  "setupTime": string,        // HH:MM 24h, when crew arrives
  "startTime": string,        // HH:MM 24h, event start
  "endTime": string,          // HH:MM 24h, event end
  "pickupDate": string,       // YYYY-MM-DD, equipment pickup date (often day after)
  "pickupTime": string,       // HH:MM 24h
  "venueName": string,
  "venueAddress": string,
  "equipment": [ { "itemName": string, "spec": string, "qty": number } ],
  "services": string[],       // e.g. delivery, riser, tech support, extended duration
  "notes": string,            // anything that is NOT scheduling info — quote deadlines,
                               // payment terms, special requests, etc. Never put this
                               // kind of content in the date/time fields.
  "meta": {
    // one entry per top-level field above (including "equipment" and "services" as single entries)
    "<fieldName>": { "confidence": "auto" | "review" | "missing", "note": string (optional) }
  }
}

Confidence rules:
- "auto": the email states this unambiguously.
- "review": you had to infer or assume something (e.g. assumed the year, assumed feet vs meters, guessed setup time from context). Put a short reason in "note".
- "missing": the email does not mention this at all. Use an empty string ("") or empty array ([]) as the value.

For "equipment", extract each distinct item with its raw description (e.g. "LED wall 8x14", "wireless mic") and quantity — do not resolve specs yourself, just extract what's stated.
For "eventType" pick the closest of: Wedding, Quinceañera, Birthday Party, Corporate, Sweet 16, Graduation, Anniversary, Other.
Never guess a client email or phone number that is not present in the text — mark those "missing" instead.
Output must be valid JSON and nothing else.`;

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
    return;
  }

  const body = (req.body ?? {}) as { text?: string };
  const text = (body.text || '').trim();
  if (!text) {
    res.status(400).json({ error: 'Missing "text" to parse.' });
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: `Anthropic API error: ${errText.slice(0, 500)}` });
      return;
    }

    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    const textBlock = data.content?.find((block) => block.type === 'text');
    if (!textBlock?.text) {
      res.status(502).json({ error: 'No text content returned by the model.' });
      return;
    }

    let parsed: AiParsedBooking;
    try {
      parsed = JSON.parse(stripFences(textBlock.text));
    } catch {
      res.status(502).json({ error: 'Model did not return valid JSON.', raw: textBlock.text.slice(0, 1000) });
      return;
    }

    // Backfill any missing keys defensively so the client always gets a
    // complete, well-typed shape regardless of minor model drift.
    for (const key of FIELD_KEYS) {
      if (!(key in parsed)) {
        (parsed as unknown as Record<string, unknown>)[key] = key === 'equipment' || key === 'services' ? [] : '';
      }
      if (!parsed.meta?.[key]) {
        parsed.meta = parsed.meta || {};
        parsed.meta[key] = { confidence: 'missing' };
      }
    }

    // Cross-reference each extracted equipment line against the LED/stage
    // calculators and the small gear catalog so specs are real, not just
    // whatever text the model guessed.
    let anyAssumed = false;
    parsed.equipment = (parsed.equipment || []).map((item) => {
      const resolved = resolveEquipmentText(`${item.itemName} ${item.spec || ''}`.trim(), item.qty || 1);
      if (resolved.confidence === 'assumed') anyAssumed = true;
      return { itemName: resolved.itemName, spec: resolved.spec || item.spec || '', qty: item.qty || 1 };
    });

    // If any equipment line couldn't be confidently resolved against the
    // catalog, downgrade the equipment field so it surfaces for a check.
    if (anyAssumed && parsed.meta.equipment?.confidence === 'auto') {
      parsed.meta.equipment = { confidence: 'review', note: 'Some items resolved against the catalog — please verify specs.' };
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
