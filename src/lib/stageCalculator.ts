export type Unit = 'ft' | 'm';
export type Orientation = 'horizontal' | 'vertical';

// Fixed platform spec: 4ft x 8ft deck panel.
export const PANEL_WIDTH_FT = 4; // short edge
export const PANEL_LENGTH_FT = 8; // long edge

// Basic flat-rate pricing: $/panel.
export const PRICE_PER_PANEL = 85;

export function calculateStagePrice(totalPanels: number): number {
  return totalPanels * PRICE_PER_PANEL;
}

const FT_TO_M = 0.3048;

export function ftToUnit(ft: number, unit: Unit): number {
  return unit === 'm' ? ft * FT_TO_M : ft;
}

export function unitToFt(value: number, unit: Unit): number {
  return unit === 'm' ? value / FT_TO_M : value;
}

export function fmt(val: number): string {
  return parseFloat(val.toFixed(3)).toString();
}

export const STAGE_QUICK_SIZES: { label: string; length: number; width: number; u: Unit }[] = [
  { label: '8×4 ft', length: 8, width: 4, u: 'ft' },
  { label: '16×4 ft', length: 16, width: 4, u: 'ft' },
  { label: '8×8 ft', length: 8, width: 8, u: 'ft' },
  { label: '16×8 ft', length: 16, width: 8, u: 'ft' },
];

export interface StageResult {
  orientation: Orientation;
  panelsAlongLength: number; // panel count laid out along the stage's length axis (for the preview grid)
  panelsAlongWidth: number; // panel count laid out along the stage's width axis
  totalPanels: number;
  totalLengthFt: number;
  totalWidthFt: number;
  aspectRatioStr: string;
  legs: number;
  support8ft: number;
  support4ft: number;
  areaSqFt: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Structural math verified against four known reference points (1 panel,
 * 2 panels joined lengthwise, 2 panels joined widthwise, and a 2x2 grid):
 *  - legs form a grid of (chainedBy8+1) x (chainedBy4+1) corner points —
 *    shared corners at internal seams are only counted once.
 *  - 8' supports run the full "chained by 8ft edge" direction, including
 *    internal seams: (chainedBy4+1) lines x chainedBy8 segments each.
 *  - 4' supports brace every panel boundary along the chained-by-8
 *    direction — including internal seams between panels chained
 *    end-to-end, not just the two outer ends: (chainedBy8+1) x chainedBy4.
 *
 * `chainedBy8`/`chainedBy4` are the panel counts along whichever physical
 * axis carries the panel's 8ft edge vs its 4ft edge — which axis that is
 * depends on orientation, since a 4x8 panel can be laid either way.
 */
export function calculateStage(
  lengthVal: number,
  widthVal: number,
  unit: Unit,
  orientation: Orientation
): StageResult | null {
  if (!(lengthVal > 0) || !(widthVal > 0)) {
    return null;
  }

  const lengthFt = unitToFt(lengthVal, unit);
  const widthFt = unitToFt(widthVal, unit);

  let panelsAlongLength: number;
  let panelsAlongWidth: number;
  let chainedBy8: number;
  let chainedBy4: number;

  if (orientation === 'horizontal') {
    // Panel's 8ft edge runs along the stage's length.
    panelsAlongLength = Math.max(1, Math.round(lengthFt / PANEL_LENGTH_FT));
    panelsAlongWidth = Math.max(1, Math.round(widthFt / PANEL_WIDTH_FT));
    chainedBy8 = panelsAlongLength;
    chainedBy4 = panelsAlongWidth;
  } else {
    // Panel rotated 90°: its 8ft edge runs along the stage's width instead.
    panelsAlongLength = Math.max(1, Math.round(lengthFt / PANEL_WIDTH_FT));
    panelsAlongWidth = Math.max(1, Math.round(widthFt / PANEL_LENGTH_FT));
    chainedBy8 = panelsAlongWidth;
    chainedBy4 = panelsAlongLength;
  }

  const totalPanels = panelsAlongLength * panelsAlongWidth;
  const totalLengthFt = panelsAlongLength * (orientation === 'horizontal' ? PANEL_LENGTH_FT : PANEL_WIDTH_FT);
  const totalWidthFt = panelsAlongWidth * (orientation === 'horizontal' ? PANEL_WIDTH_FT : PANEL_LENGTH_FT);

  const legs = (chainedBy8 + 1) * (chainedBy4 + 1);
  const support8ft = (chainedBy4 + 1) * chainedBy8;
  const support4ft = (chainedBy8 + 1) * chainedBy4;

  const areaSqFt = totalLengthFt * totalWidthFt;

  const g = gcd(totalLengthFt, totalWidthFt) || 1;
  const aspectRatioStr = `${totalLengthFt / g}:${totalWidthFt / g}`;

  return {
    orientation,
    panelsAlongLength,
    panelsAlongWidth,
    totalPanels,
    totalLengthFt,
    totalWidthFt,
    aspectRatioStr,
    legs,
    support8ft,
    support4ft,
    areaSqFt,
  };
}
