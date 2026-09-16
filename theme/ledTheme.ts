// Flat dark palette matching the website calculator exactly — separate
// from theme.ts's gradient/glass system used elsewhere in the app shell.
export const flat = {
  surface: 'rgba(255, 255, 255, 0.03)',
  surfaceAlt: 'rgba(255, 255, 255, 0.02)',
  surfaceInput: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.1)',
  text: '#ffffff',
  textDim: 'rgba(255, 255, 255, 0.7)',
  textFaint: 'rgba(255, 255, 255, 0.4)',
  textFainter: 'rgba(255, 255, 255, 0.3)',
  textGhost: 'rgba(255, 255, 255, 0.15)',
};

// Per-metric neon accents, taken directly from the website's ResultCard usage.
export const neon = {
  cyan: '#00d4ff',
  green: '#00ff88',
  purple: '#a78bfa',
  mint: '#34d399',
  orange: '#fb923c',
  pink: '#f472b6',
};
