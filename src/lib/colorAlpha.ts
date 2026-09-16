// CSS custom properties (e.g. `var(--neon-cyan)`) can't be alpha-blended by
// appending a hex-alpha suffix the way literal hex colors can — that just
// produces an invalid `var(--neon-cyan)30` color which browsers silently
// drop, falling back to a default (often reading as a flat white/gray
// border). color-mix() works for both CSS vars and hex/rgba alike.
export function colorAlpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
