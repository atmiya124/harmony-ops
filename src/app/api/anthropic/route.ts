import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: 'Anthropic API key is not configured. Add ANTHROPIC_API_KEY to your environment.',
      }, { status: 400 });
    }

    const prompt = `
Extract structured booking data from the following email/text.
Return valid JSON only, no markdown fences.

Schema:
{
  clientName: string | null,
  clientEmail: string | null,
  clientPhone: string | null,
  eventType: string | null,
  venueName: string | null,
  venueAddress: string | null,
  eventDate: string | null,
  setupTime: string | null,
  startTime: string | null,
  endTime: string | null,
  pickupDetail: string | null,
  services: string[],
  equipment: Array<{ name: string, qty: number | null, dimensions: string | null }>,
  notes: string,
  status: 'Tentative' | 'Confirmed' | 'Cancelled'
}

Rules:
- Keep notes separate from scheduling items; do not put quote deadlines or non-scheduling instructions into date fields.
- For equipment, prefer quantities and dimensions when present.
- If an event date is not explicit, return null.
- If a field is unknown, use null or empty array.

Text:
${text}
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: 'Anthropic request failed', details: errorText }, { status: 500 });
    }

    const json = await response.json();
    const content = json.content?.[0]?.text ?? '{}';
    const cleaned = content.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({ parsed });
    } catch {
      return NextResponse.json({ parsed: {}, raw: cleaned }, { status: 200 });
    }
  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected Anthropic parsing error',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
