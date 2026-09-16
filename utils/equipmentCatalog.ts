import { PANEL, calculateLedWall } from './ledCalculator';
import { PANEL_LENGTH_FT, PANEL_WIDTH_FT, calculateStage } from './stageCalculator';

// Small reference catalog for gear that isn't dimension-driven. Used to
// resolve a plain-text equipment name to a canonical spec/power string.
export const EQUIPMENT_CATALOG: { match: RegExp; itemName: string; spec: string; powerW?: number }[] = [
  { match: /sound system|pa system/i, itemName: 'Sound System', spec: 'Dual 15" PA + sub', powerW: 1200 },
  { match: /wireless mic/i, itemName: 'Wireless Mic', spec: 'UHF handheld/lav', powerW: 5 },
  { match: /podium mic|wired mic/i, itemName: 'Wired Mic', spec: 'XLR dynamic', powerW: 0 },
  { match: /dj equipment|dj booth/i, itemName: 'DJ Equipment', spec: 'Controller + mixer', powerW: 300 },
  { match: /uplight/i, itemName: 'Uplighting', spec: 'RGBW LED par, wireless DMX', powerW: 30 },
  { match: /string light/i, itemName: 'String Lights', spec: 'Warm white, 48ft run', powerW: 100 },
  { match: /fog machine|haze/i, itemName: 'Fog Machine', spec: '1500W fluid-based', powerW: 1500 },
  { match: /projector/i, itemName: 'Projector', spec: '8000 lumen', powerW: 400 },
  { match: /screen/i, itemName: 'Projection Screen', spec: 'Fast-fold, front/rear', powerW: 0 },
  { match: /truss/i, itemName: 'Truss', spec: '12" box truss section', powerW: 0 },
  { match: /moving head/i, itemName: 'Moving Head', spec: 'LED spot/wash', powerW: 300 },
  { match: /par light|par can/i, itemName: 'PAR Light', spec: 'LED PAR64', powerW: 40 },
  { match: /confidence monitor/i, itemName: 'Confidence Monitor', spec: '55" LED display', powerW: 150 },
  { match: /photo booth/i, itemName: 'Photo Booth', spec: 'Enclosed, printer + props', powerW: 200 },
  { match: /neon sign/i, itemName: 'Neon Sign', spec: 'Custom LED neon', powerW: 20 },
  { match: /flight box|flight case/i, itemName: 'Flight Box', spec: `${8} panels each`, powerW: 0 },
  { match: /power strip|distro/i, itemName: 'Power Strip', spec: '20A distro', powerW: 0 },
  { match: /media server|video switcher/i, itemName: 'Video Switcher', spec: 'Multi-input HD switcher', powerW: 150 },
];

export interface ResolvedEquipment {
  itemName: string;
  spec: string;
  qty: number;
  confidence: 'high' | 'assumed';
}

const LED_WALL_RE = /led\s*(wall|backdrop|screen)?\D{0,10}(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i;
const STAGE_RE = /stage\D{0,10}(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i;

/**
 * Resolves a free-text equipment description (e.g. "LED wall 8x14",
 * "Stage 16x8", "wireless mic x4") against the LED/stage calculators and the
 * small gear catalog above, so AI-extracted or hand-typed items get real
 * spec data instead of staying as opaque strings.
 */
export function resolveEquipmentText(raw: string, qty = 1): ResolvedEquipment {
  const text = raw.trim();

  const ledMatch = text.match(LED_WALL_RE);
  if (ledMatch) {
    const w = parseFloat(ledMatch[2]);
    const h = parseFloat(ledMatch[3]);
    const result = calculateLedWall(w, h, 'ft');
    if (result) {
      return {
        itemName: `LED Wall (${PANEL.name})`,
        spec: `${w}×${h}ft → ${result.actualWidthDisplay}×${result.actualHeightDisplay}ft · ${result.totalPanelsCeil} panels · ${result.totalPixelsW}×${result.totalPixelsH}px · ${result.totalPowerKW.toFixed(1)}kW`,
        qty,
        confidence: 'high',
      };
    }
  }

  const stageMatch = text.match(STAGE_RE);
  if (stageMatch) {
    const l = parseFloat(stageMatch[1]);
    const w = parseFloat(stageMatch[2]);
    const result = calculateStage(l, w, 'ft', 'horizontal');
    if (result) {
      return {
        itemName: `Stage Deck (${PANEL_LENGTH_FT}×${PANEL_WIDTH_FT}ft panels)`,
        spec: `${l}×${w}ft → ${result.totalPanels} panels · ${result.legs} legs · ${result.areaSqFt} sq ft`,
        qty,
        confidence: 'high',
      };
    }
  }

  const catalogHit = EQUIPMENT_CATALOG.find((entry) => entry.match.test(text));
  if (catalogHit) {
    return { itemName: catalogHit.itemName, spec: catalogHit.spec, qty, confidence: 'high' };
  }

  // No catalog match — keep the raw text but flag it as an assumption.
  return { itemName: text || 'Equipment item', spec: '', qty, confidence: 'assumed' };
}

export const EQUIPMENT_SUGGESTIONS = [
  'LED Wall',
  'Stage Panel 8x4\'',
  'Stage Panel 4x4\'',
  'Sound System',
  'Wireless Mic',
  'Wired Mic',
  'Truss Section',
  'Moving Head',
  'PAR Light',
  'Uplighting',
  'Projector',
  'Projection Screen',
  'Fog Machine',
  'Power Strip',
];
