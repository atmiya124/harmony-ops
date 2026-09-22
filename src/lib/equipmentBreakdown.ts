import { parseDimensions } from './parseDimensions';
import { calculateLedWall } from './ledCalculator';
import { calculateStage } from './stageCalculator';

export interface EquipmentBreakdownLine {
  label: string;
  value: number;
}

// Purely a display-time re-derivation for the booking detail page — the
// stored spec/qty on a booking_equipment row don't carry structured panel
// counts (that table is shared with another app and can't gain columns),
// so this re-parses the dimensions already embedded in the spec text and
// re-runs the same calculator math the resolver used when the line was
// first created.
export function deriveEquipmentBreakdown(itemName: string, spec: string): EquipmentBreakdownLine[] {
  const dims = parseDimensions(spec) ?? parseDimensions(itemName);
  if (!dims) return [];

  const name = itemName.toLowerCase();
  if (name.includes('led')) {
    const result = calculateLedWall(dims.w, dims.h, dims.unit);
    if (!result) return [];
    return [
      { label: 'Panels', value: result.totalPanelsCeil },
      { label: 'Flight boxes', value: result.flightBoxes },
    ];
  }
  if (name.includes('stage')) {
    const result = calculateStage(dims.w, dims.h, dims.unit, 'horizontal');
    if (!result) return [];
    return [{ label: 'Stage Deck', value: result.totalPanels }];
  }
  return [];
}
