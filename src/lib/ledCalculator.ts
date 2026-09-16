export type Unit = 'm' | 'ft';

export type PanelSpec = {
  name: string;
  widthMm: number;
  heightMm: number;
  pixelsW: number;
  pixelsH: number;
  weightKg: number;
  powerW: number;
  maxBrightnessNits: number;
};

// Fixed panel spec: P2.6 Standard (matches the website's calculator).
export const PANEL: PanelSpec = {
  name: 'P2.6 · 500×500mm',
  widthMm: 500,
  heightMm: 500,
  pixelsW: 192,
  pixelsH: 192,
  weightKg: 7.5,
  powerW: 200,
  maxBrightnessNits: 5000,
};

// Basic flat-rate pricing: $/sq ft of actual (panel-rounded) screen area.
export const PRICE_PER_SQFT = 17;

export function calculateLedPrice(sqFt: number): number {
  return sqFt * PRICE_PER_SQFT;
}

export type AspectPreset = {
  label: string;
  w: number;
  h: number;
};

export const ASPECT_PRESETS: AspectPreset[] = [
  { label: '16:9', w: 16, h: 9 },
  { label: '4:3', w: 4, h: 3 },
  { label: '2:1', w: 2, h: 1 },
  { label: '21:9', w: 21, h: 9 },
  { label: '1:1', w: 1, h: 1 },
  { label: '9:16', w: 9, h: 16 },
];

export const QUICK_SIZES: { label: string; w: number; h: number; u: Unit }[] = [
  { label: '10×6 ft', w: 10, h: 6, u: 'ft' },
  { label: '16×9 ft', w: 16, h: 9, u: 'ft' },
  { label: '20×10 ft', w: 20, h: 10, u: 'ft' },
  { label: '3×2 m', w: 3, h: 2, u: 'm' },
];

export function mmToUnit(mm: number, unit: Unit): number {
  return unit === 'm' ? mm / 1000 : mm / 304.8;
}

export function unitToMm(val: number, unit: Unit): number {
  return unit === 'm' ? val * 1000 : val * 304.8;
}

/** Trims trailing float noise (e.g. 6.000000001 -> "6") without over-rounding. */
export function fmt(val: number): string {
  return parseFloat(val.toFixed(3)).toString();
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export interface LedWallResult {
  colsCeil: number;
  rowsCeil: number;
  totalPanelsCeil: number;
  actualWidthMm: number;
  actualHeightMm: number;
  actualWidthDisplay: string;
  actualHeightDisplay: string;
  totalPixelsW: number;
  totalPixelsH: number;
  totalMegapixels: number;
  flightBoxes: number;
  totalPowerKW: number;
  ampere16A: number;
  ampere32A: number;
  sqFt: number;
  sqM: number;
  pixelPitch: number;
  minViewingDist: number;
  aspectRatioStr: string;
  powerMainCables: number;
  powerJumpCables: number;
  powerExtensionCables: number;
  dataMainCables: number;
  dataJumpCables: number;
}

export function calculateLedWall(widthVal: number, heightVal: number, unit: Unit): LedWallResult | null {
  if (!(widthVal > 0) || !(heightVal > 0)) {
    return null;
  }

  const widthMm = unitToMm(widthVal, unit);
  const heightMm = unitToMm(heightVal, unit);
  const panelW = PANEL.widthMm;
  const panelH = PANEL.heightMm;

  // Round to the closest whole number of panels (not always up). e.g. a
  // 30x10ft wall becomes 18x6 panels rather than 19x7.
  const rawCols = widthMm / panelW;
  const rawRows = heightMm / panelH;

  const colsCeil = widthMm > 0 ? Math.max(1, Math.round(rawCols)) : 0;
  const rowsCeil = heightMm > 0 ? Math.max(1, Math.round(rawRows)) : 0;

  const totalPanelsCeil = colsCeil * rowsCeil;

  const actualWidthMm = colsCeil * panelW;
  const actualHeightMm = rowsCeil * panelH;

  const totalPixelsW = colsCeil * PANEL.pixelsW;
  const totalPixelsH = rowsCeil * PANEL.pixelsH;
  const totalMegapixels = (totalPixelsW * totalPixelsH) / 1_000_000;

  const flightBoxes = Math.ceil(totalPanelsCeil / 8);
  const totalPowerW = totalPanelsCeil * PANEL.powerW;
  const totalPowerKW = totalPowerW / 1000;
  const ampere16A = Math.ceil(totalPowerW / (230 * 16));
  const ampere32A = Math.ceil(totalPowerW / (230 * 32));

  const sqFt = (actualWidthMm / 304.8) * (actualHeightMm / 304.8);
  const sqM = (actualWidthMm / 1000) * (actualHeightMm / 1000);

  const pixelPitch = panelW / PANEL.pixelsW;
  const minViewingDist = pixelPitch * 1000;

  const g = gcd(colsCeil, rowsCeil);
  const aspectRatioStr = g > 0 ? `${colsCeil / g}:${rowsCeil / g}` : '—';

  // Power runs horizontally across each row in a "snake" pattern.
  const powerMainCables = totalPanelsCeil > 0 ? Math.ceil(totalPanelsCeil / 12) : 0;
  const powerJumpCables = rowsCeil * Math.max(0, colsCeil - 1);
  const powerExtensionCables = rowsCeil > 1 ? rowsCeil - 1 : 0;

  // Data runs vertically down each column.
  const dataMainCables = colsCeil;
  const dataJumpCables = colsCeil * Math.max(0, rowsCeil - 1);

  return {
    colsCeil,
    rowsCeil,
    totalPanelsCeil,
    actualWidthMm,
    actualHeightMm,
    actualWidthDisplay: mmToUnit(actualWidthMm, unit).toFixed(2),
    actualHeightDisplay: mmToUnit(actualHeightMm, unit).toFixed(2),
    totalPixelsW,
    totalPixelsH,
    totalMegapixels,
    flightBoxes,
    totalPowerKW,
    ampere16A,
    ampere32A,
    sqFt,
    sqM,
    pixelPitch,
    minViewingDist,
    aspectRatioStr,
    powerMainCables,
    powerJumpCables,
    powerExtensionCables,
    dataMainCables,
    dataJumpCables,
  };
}
