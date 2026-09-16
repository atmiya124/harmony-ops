export interface PricingSettings {
  ledPricePerSqft: number;
  stagePricePerPanel: number;
}

async function extractError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error) return body.error;
  } catch {
    // ignore — fall through to generic message
  }
  return `Request failed (${res.status})`;
}

export async function getPricingSettings(): Promise<PricingSettings> {
  const res = await fetch('/api/pricing-settings');
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

export async function savePricingSettings(settings: PricingSettings): Promise<PricingSettings> {
  const res = await fetch('/api/pricing-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}
