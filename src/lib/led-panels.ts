export interface LedPanel {
  id: string;
  name: string;
  pitchMm: number;
  widthMm: number;
  heightMm: number;
  pixelCols: number;
  pixelRows: number;
  weightPerM2: number;
  powerPerM2: number;
  category: 'indoor' | 'outdoor' | 'custom';
  description: string;
}

export const LED_PANELS: LedPanel[] = [
  {
    id: 'p19',
    name: 'P1.9',
    pitchMm: 1.9,
    widthMm: 500,
    heightMm: 500,
    pixelCols: 264,
    pixelRows: 264,
    weightPerM2: 9.8,
    powerPerM2: 600,
    category: 'indoor',
    description: 'Ultra-fine pitch for broadcast & close viewing',
  },
  {
    id: 'p26',
    name: 'P2.6',
    pitchMm: 2.6,
    widthMm: 500,
    heightMm: 500,
    pixelCols: 192,
    pixelRows: 192,
    weightPerM2: 9.5,
    powerPerM2: 550,
    category: 'indoor',
    description: 'Premium indoor for conferences & studios',
  },
  {
    id: 'p29',
    name: 'P2.9',
    pitchMm: 2.976,
    widthMm: 500,
    heightMm: 500,
    pixelCols: 168,
    pixelRows: 168,
    weightPerM2: 9.5,
    powerPerM2: 500,
    category: 'indoor',
    description: 'Industry standard for stage & events',
  },
  {
    id: 'p39',
    name: 'P3.9',
    pitchMm: 3.9,
    widthMm: 500,
    heightMm: 500,
    pixelCols: 128,
    pixelRows: 128,
    weightPerM2: 8.5,
    powerPerM2: 450,
    category: 'indoor',
    description: 'Most popular rental panel worldwide',
  },
  {
    id: 'p48',
    name: 'P4.8',
    pitchMm: 4.8,
    widthMm: 576,
    heightMm: 576,
    pixelCols: 120,
    pixelRows: 120,
    weightPerM2: 8.0,
    powerPerM2: 400,
    category: 'indoor',
    description: 'Versatile for mid-large indoor events',
  },
  {
    id: 'p59',
    name: 'P5.9',
    pitchMm: 5.95,
    widthMm: 960,
    heightMm: 960,
    pixelCols: 160,
    pixelRows: 160,
    weightPerM2: 24.0,
    powerPerM2: 600,
    category: 'outdoor',
    description: 'Outdoor-rated for festivals & large venues',
  },
  {
    id: 'p78',
    name: 'P7.8',
    pitchMm: 7.8,
    widthMm: 960,
    heightMm: 960,
    pixelCols: 123,
    pixelRows: 123,
    weightPerM2: 26.0,
    powerPerM2: 650,
    category: 'outdoor',
    description: 'High-brightness outdoor for direct sunlight',
  },
];

export const CUSTOM_PANEL: LedPanel = {
  id: 'custom',
  name: 'Custom',
  pitchMm: 3.9,
  widthMm: 500,
  heightMm: 500,
  pixelCols: 128,
  pixelRows: 128,
  weightPerM2: 8.5,
  powerPerM2: 450,
  category: 'custom',
  description: 'Enter your own panel specifications',
};

export interface WallCalculation {
  wallWidthM: number;
  wallHeightM: number;
  wallWidthFt: number;
  wallHeightFt: number;
  totalPanels: number;
  totalPixelsW: number;
  totalPixelsH: number;
  totalResolution: number;
  areaM2: number;
  areaFt2: number;
  totalWeightKg: number;
  totalPowerKw: number;
  minViewingDistM: number;
  optViewingDistM: number;
  maxViewingDistM: number;
  aspectRatio: string;
}

export interface WallStructure {
  flightBoxes: number;
  mainPowerCables: number;
  powerJumpCables: number;
  powerExtensionCables: number;
  dataMainCables: number;
  dataJumpCables: number;
}

export function calculateStructure(totalPanels: number, cols: number, rows: number): WallStructure {
  const flightBoxes = Math.ceil(totalPanels / 8);
  const mainPowerCables = Math.ceil(totalPanels / 15);
  const powerJumpCables = mainPowerCables * cols;
  const powerExtensionCables = Math.ceil(rows / 2);
  const dataMainCables = Math.max(0, cols - 1);
  const dataJumpCables = dataMainCables * Math.ceil(rows / 2);
  return {
    flightBoxes,
    mainPowerCables,
    powerJumpCables,
    powerExtensionCables,
    dataMainCables,
    dataJumpCables,
  };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function calculateWall(panel: LedPanel, cols: number, rows: number): WallCalculation {
  const wallWidthM = (panel.widthMm * cols) / 1000;
  const wallHeightM = (panel.heightMm * rows) / 1000;
  const wallWidthFt = wallWidthM * 3.28084;
  const wallHeightFt = wallHeightM * 3.28084;
  const totalPanels = cols * rows;
  const totalPixelsW = panel.pixelCols * cols;
  const totalPixelsH = panel.pixelRows * rows;
  const totalResolution = totalPixelsW * totalPixelsH;
  const areaM2 = wallWidthM * wallHeightM;
  const areaFt2 = areaM2 * 10.7639;
  const totalWeightKg = areaM2 * panel.weightPerM2;
  const totalPowerKw = (areaM2 * panel.powerPerM2) / 1000;
  const minViewingDistM = panel.pitchMm * 0.7;
  const optViewingDistM = panel.pitchMm * 1.5;
  const maxViewingDistM = panel.pitchMm * 3.5;

  const g = gcd(totalPixelsW, totalPixelsH) || 1;
  const aspectRatio = `${totalPixelsW / g}:${totalPixelsH / g}`;

  return {
    wallWidthM,
    wallHeightM,
    wallWidthFt,
    wallHeightFt,
    totalPanels,
    totalPixelsW,
    totalPixelsH,
    totalResolution,
    areaM2,
    areaFt2,
    totalWeightKg,
    totalPowerKw,
    minViewingDistM,
    optViewingDistM,
    maxViewingDistM,
    aspectRatio,
  };
}

export type RatioKey = 'free' | '16:9' | '9:16' | '4:3' | '3:4' | '1:1';

export const RATIO_OPTIONS: { label: string; key: RatioKey; value: number | null }[] = [
  { label: 'Free', key: 'free', value: null },
  { label: '16:9', key: '16:9', value: 16 / 9 },
  { label: '9:16', key: '9:16', value: 9 / 16 },
  { label: '4:3', key: '4:3', value: 4 / 3 },
  { label: '3:4', key: '3:4', value: 3 / 4 },
  { label: '1:1', key: '1:1', value: 1 },
];

export interface SavedConfig {
  id: string;
  name: string;
  panelId: string;
  panel: LedPanel;
  cols: number;
  rows: number;
  result: WallCalculation;
  createdAt: number;
}

export const SAVED_CONFIGS_KEY = 'harmony-calc-saved-configs';
export const PENDING_LOAD_KEY = 'harmony-calc-pending-load';
export const UNIT_KEY = 'harmony-calc-unit';

export function fmt(n: number, digits = 2): string {
  if (!isFinite(n)) return '—';
  return n.toFixed(digits).replace(/\.?0+$/, '') || '0';
}
