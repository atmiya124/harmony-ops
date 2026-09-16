import { equipmentCatalog } from './harmony-data';

export function calculateLedWall(widthFeet: number, heightFeet: number, pixelPitch = 3.9) {
  if (!widthFeet || !heightFeet || Number.isNaN(widthFeet) || Number.isNaN(heightFeet)) {
    return null;
  }

  const panelWidth = 1.64;
  const panelHeight = 1.64;
  const cols = Math.max(1, Math.ceil(widthFeet / panelWidth));
  const rows = Math.max(1, Math.ceil(heightFeet / panelHeight));
  const totalPanels = cols * rows;
  const actualWidth = Number((cols * panelWidth).toFixed(2));
  const actualHeight = Number((rows * panelHeight).toFixed(2));
  const powerDraw = Number(((totalPanels * 0.12 * Number(pixelPitch)) / 2.5).toFixed(1));

  return {
    cols,
    rows,
    totalPanels,
    actualWidth,
    actualHeight,
    resolution: `${cols * 64}x${rows * 64}`,
    powerDraw,
  };
}

export function matchCatalogItem(rawText: string) {
  const normalized = rawText.toLowerCase();
  const match = equipmentCatalog.find((item) => normalized.includes(item.name.toLowerCase().replace('led wall ', '')) || normalized.includes(item.name.toLowerCase()));

  if (!match) return null;
  return match;
}
