import { PANEL } from '@/lib/ledCalculator';

const rows = [
  { label: 'Panel size', value: `${PANEL.widthMm}×${PANEL.heightMm}mm` },
  { label: 'Resolution', value: `${PANEL.pixelsW}×${PANEL.pixelsH}px` },
  { label: 'Pixel pitch', value: `${(PANEL.widthMm / PANEL.pixelsW).toFixed(2)}mm` },
  { label: 'Weight', value: `${PANEL.weightKg} kg` },
  { label: 'Power draw', value: `${PANEL.powerW} W` },
  { label: 'Max brightness', value: `${PANEL.maxBrightnessNits.toLocaleString()} nits` },
];

export default function PanelInfoSection() {
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
