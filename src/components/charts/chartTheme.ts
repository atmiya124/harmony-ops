'use client';

import { useSyncExternalStore } from 'react';

// One source of truth for how every Harmony Ops chart looks. Screens pick a
// series color by *meaning* (SERIES.event, SERIES.reimbursement…), never by
// position, so a metric keeps its color everywhere it appears.
//
// These are the app's neon hues stepped down into the dark-mode data band
// (OKLCH L 0.48–0.67), validated against the card surface #0a0f16 for
// *every* pair, not just neighbours (a split ring or stacked bar can put any
// two side by side): ≥3:1 contrast, normal-vision ΔE ≥ 17.4, colour-blind
// ΔE ≥ 6.9 (green↔orange — legal only where parts are also gapped and labelled).
// The green was #059669 until it proved too close to the cyan (ΔE 11.8).
// The brighter --neon-* tokens stay for text/UI accents; they are too light
// for filled data marks. Order matters: assign in this order, never cycle.
export const CATEGORICAL = ['#0891b2', '#ea580c', '#8b5cf6', '#16a34a'] as const;

export const SERIES = {
  total: CATEGORICAL[0],
  event: CATEGORICAL[1],
  reimbursement: CATEGORICAL[2],
  company: CATEGORICAL[3],
  // Money in. Shares the green with `company`, which never appears on the
  // same screen (company is only on SpendingCard).
  income: CATEGORICAL[3],
} as const;

export const CHART = {
  surface: '#0a0f16', // card background, used for the 2px ring around dots
  ink: '#ffffff',
  inkMuted: 'rgba(255, 255, 255, 0.4)',
  // Columns: every period in the muted step, the one being read in `emphasis`.
  columnMuted: 'rgba(255, 255, 255, 0.16)',
  columnHover: 'rgba(255, 255, 255, 0.32)',
  columnEmphasis: '#ffffff',
  crosshair: 'rgba(255, 255, 255, 0.22)',
  axisFontSize: 10,
  lineWidth: 2,
  dotRadius: 4,
  barRadius: 4,
  maxBarSize: 24,
  // Gradient wash under areas: faint at the line, gone at the baseline.
  areaTopOpacity: 0.28,
  areaBottomOpacity: 0,
  animationMs: 700,
  animationEasing: 'ease-out' as const,
};

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

// Charts animate in unless the viewer has asked the OS for less motion.
export function useChartAnimation(): boolean {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true, // server render: no animation until hydrated
  );
  return !reduced;
}

export interface ChartDatum {
  label: string; // x position: a date or period name shown in tooltips/ticks
  value: number; // integer cents
}
