import { PANEL_LENGTH_FT, PANEL_WIDTH_FT } from '@/lib/stageCalculator';

const rows = [
  { label: 'Panel size', value: `${PANEL_LENGTH_FT}×${PANEL_WIDTH_FT}ft` },
  { label: 'Legs per panel', value: '4' },
  { label: '8\' supports', value: '2 per panel' },
  { label: '4\' supports', value: '2 per panel' },
];

export default function StagePanelInfoSection() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {rows.map((row) => (
        <div key={row.label}>
          <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--flat-text-fainter)]">{row.label}</p>
          <p className="mt-0.5 text-sm font-medium text-[var(--flat-text)]">{row.value}</p>
        </div>
      ))}
    </div>
  );
}
