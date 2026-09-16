import { db } from './client';
import { equipmentCatalog } from './schema';
import { PANEL } from '../ledCalculator';
import { PANEL_LENGTH_FT, PANEL_WIDTH_FT } from '../stageCalculator';

const rows = [
  {
    id: 'cat-led-p26',
    itemName: `LED Wall Panel (${PANEL.name})`,
    category: 'led_panel' as const,
    pixelPitch: PANEL.widthMm / PANEL.pixelsW,
    panelWidth: PANEL.widthMm,
    panelHeight: PANEL.heightMm,
    powerDrawWatts: PANEL.powerW,
    keywords: 'led wall,led screen,led backdrop,video wall,led panel',
  },
  {
    id: 'cat-stage-4x8',
    itemName: `Stage Deck Panel (${PANEL_LENGTH_FT}×${PANEL_WIDTH_FT}ft)`,
    category: 'stage_panel' as const,
    pixelPitch: null,
    panelWidth: PANEL_LENGTH_FT * 304.8,
    panelHeight: PANEL_WIDTH_FT * 304.8,
    powerDrawWatts: null,
    keywords: 'stage,stage deck,stage panel,platform,riser',
  },
  { id: 'cat-sound-system', itemName: 'Sound System', category: 'audio' as const, keywords: 'sound system,pa system' },
  { id: 'cat-wireless-mic', itemName: 'Wireless Mic', category: 'audio' as const, keywords: 'wireless mic' },
  { id: 'cat-wired-mic', itemName: 'Wired Mic', category: 'audio' as const, keywords: 'podium mic,wired mic' },
  { id: 'cat-dj-equipment', itemName: 'DJ Equipment', category: 'audio' as const, keywords: 'dj equipment,dj booth' },
  { id: 'cat-uplighting', itemName: 'Uplighting', category: 'lighting' as const, keywords: 'uplight,uplighting' },
  { id: 'cat-string-lights', itemName: 'String Lights', category: 'lighting' as const, keywords: 'string light,string lights' },
  { id: 'cat-fog-machine', itemName: 'Fog Machine', category: 'lighting' as const, keywords: 'fog machine,haze' },
  { id: 'cat-projector', itemName: 'Projector', category: 'other' as const, keywords: 'projector' },
  { id: 'cat-projection-screen', itemName: 'Projection Screen', category: 'other' as const, keywords: 'screen,projection screen' },
  { id: 'cat-truss', itemName: 'Truss', category: 'other' as const, keywords: 'truss' },
  { id: 'cat-moving-head', itemName: 'Moving Head', category: 'lighting' as const, keywords: 'moving head' },
  { id: 'cat-par-light', itemName: 'PAR Light', category: 'lighting' as const, keywords: 'par light,par can' },
  { id: 'cat-confidence-monitor', itemName: 'Confidence Monitor', category: 'other' as const, keywords: 'confidence monitor' },
  { id: 'cat-photo-booth', itemName: 'Photo Booth', category: 'other' as const, keywords: 'photo booth' },
  { id: 'cat-neon-sign', itemName: 'Neon Sign', category: 'lighting' as const, keywords: 'neon sign' },
  { id: 'cat-flight-box', itemName: 'Flight Box', category: 'other' as const, keywords: 'flight box,flight case' },
  { id: 'cat-power-strip', itemName: 'Power Strip', category: 'other' as const, keywords: 'power strip,distro' },
  { id: 'cat-video-switcher', itemName: 'Video Switcher', category: 'other' as const, keywords: 'media server,video switcher' },
];

async function seed() {
  for (const row of rows) {
    await db
      .insert(equipmentCatalog)
      .values(row)
      .onConflictDoUpdate({ target: equipmentCatalog.id, set: row });
  }
  console.log(`Seeded ${rows.length} equipment_catalog rows.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
