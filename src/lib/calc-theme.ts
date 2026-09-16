// Exact palette ported from Event-Ledger's artifacts/led-wall-calc/constants/colors.ts
// (the RN app's "fitnessTheme" — cyan/orange are intentionally the same hex there).
export const calcColors = {
  background: '#141414',
  foreground: '#FFFFFF',
  card: '#1E1E1E',
  cardForeground: '#FFFFFF',
  primary: '#F97316',
  primaryForeground: '#FFFFFF',
  secondary: '#252525',
  secondaryForeground: '#FFFFFF',
  muted: '#252525',
  mutedForeground: '#888888',
  accent: '#F97316',
  accentForeground: '#FFFFFF',
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  border: '#2C2C2C',
  input: '#252525',
  tint: '#F97316',
  cyan: '#F97316',
  orange: '#F97316',
  green: '#4ADE80',
  purple: '#A78BFA',
  radius: 18,
} as const;

// Mirrors the RN app's `color + "18"` hex-alpha-suffix technique.
export function alpha(hex: string, suffix: string) {
  return `${hex}${suffix}`;
}
