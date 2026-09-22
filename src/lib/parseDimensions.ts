// No server-only imports here (no db client) — this must stay safe to use
// from client components too.
const DIMENSION_RE = /(\d+(?:\.\d+)?)\s*(?:ft|feet|'|m|meters?)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(m|meters?)?/i;

export function parseDimensions(text: string): { w: number; h: number; unit: 'ft' | 'm' } | null {
  const match = text.match(DIMENSION_RE);
  if (!match) return null;
  const w = parseFloat(match[1]);
  const h = parseFloat(match[2]);
  if (!w || !h) return null;
  const unit = match[3] ? 'm' : 'ft';
  return { w, h, unit };
}
