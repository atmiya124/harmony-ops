import { db } from './db/client';
import { equipmentCatalog, EquipmentCatalogRow } from './db/schema';
import { calculateLedWall } from './ledCalculator';
import { calculateStage } from './stageCalculator';

export type AiConfidence = 'confirmed' | 'assumed' | 'missing';

export interface ResolvedEquipmentLine {
  itemName: string;
  spec: string;
  qty: number;
  confidence: AiConfidence;
}

const DIMENSION_RE = /(\d+(?:\.\d+)?)\s*(?:ft|feet|'|m|meters?)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(m|meters?)?/i;

function parseDimensions(text: string): { w: number; h: number; unit: 'ft' | 'm' } | null {
  const match = text.match(DIMENSION_RE);
  if (!match) return null;
  const w = parseFloat(match[1]);
  const h = parseFloat(match[2]);
  if (!w || !h) return null;
  const unit = match[3] ? 'm' : 'ft';
  return { w, h, unit };
}

let catalogCache: EquipmentCatalogRow[] | null = null;

async function loadCatalog(): Promise<EquipmentCatalogRow[]> {
  if (catalogCache) return catalogCache;
  catalogCache = await db.select().from(equipmentCatalog);
  return catalogCache;
}

function matchCatalogRow(rows: EquipmentCatalogRow[], itemName: string): EquipmentCatalogRow | null {
  const normalized = itemName.toLowerCase();
  for (const row of rows) {
    const keywords = row.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    if (keywords.some((kw) => normalized.includes(kw))) return row;
  }
  return null;
}

/**
 * Resolves one extracted equipment line against the equipment_catalog
 * table. If it matches an LED or stage panel and dimensions can be parsed
 * out of the item name/spec text, runs the real calculator math and folds
 * the computed result into the spec string — the same numbers the
 * calculator's own "attach to event" flow would produce. A line that
 * can't be confidently matched is downgraded rather than guessed.
 */
export async function resolveEquipmentLine(
  itemName: string,
  spec: string,
  qty: number,
  aiConfidence: AiConfidence,
): Promise<ResolvedEquipmentLine> {
  const rows = await loadCatalog();
  const catalogRow = matchCatalogRow(rows, itemName);
  const dims = parseDimensions(spec) ?? parseDimensions(itemName);

  let enrichedSpec = spec;
  let confidence: AiConfidence = aiConfidence;

  if (catalogRow?.category === 'led_panel' && dims) {
    const result = calculateLedWall(dims.w, dims.h, dims.unit);
    if (result) {
      enrichedSpec = `${spec || `${dims.w}x${dims.h}${dims.unit}`} → ${result.totalPixelsW}×${result.totalPixelsH}px, ${result.totalPowerKW.toFixed(1)}kW`;
    }
  } else if (catalogRow?.category === 'stage_panel' && dims) {
    const result = calculateStage(dims.w, dims.h, dims.unit, 'horizontal');
    if (result) {
      enrichedSpec = `${spec || `${dims.w}x${dims.h}${dims.unit}`} → ${result.totalPanels} panels, ${result.legs} legs`;
    }
  }

  if (!catalogRow) {
    confidence = aiConfidence === 'missing' ? 'missing' : 'assumed';
  } else if ((catalogRow.category === 'led_panel' || catalogRow.category === 'stage_panel') && !dims) {
    confidence = 'assumed';
  }

  return { itemName: catalogRow?.itemName ?? itemName, spec: enrichedSpec, qty, confidence };
}
