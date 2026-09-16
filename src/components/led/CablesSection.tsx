import { LedWallResult } from '@/lib/ledCalculator';

export default function CablesSection({ results }: { results: LedWallResult }) {
  const powerRows = [
    { label: 'Main Power Cables', value: results.powerMainCables, note: '1 per 12 panels' },
    { label: 'Power Jump Cables', value: results.powerJumpCables, note: 'horizontal, within rows' },
    { label: 'Power Extension Cables', value: results.powerExtensionCables, note: 'vertical drops between rows' },
  ];
  const dataRows = [
    { label: 'Data Main Cables', value: results.dataMainCables, note: '1 per column' },
    { label: 'Data Jump Cables', value: results.dataJumpCables, note: 'vertical, within columns' },
  ];

  return (
    <div>
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--neon-pink)]">⚡ Power Cables</p>
      <div className="space-y-2">
        {powerRows.map((row) => (
          <div key={row.label} className="rounded-lg border border-[rgba(244,114,182,0.12)] bg-[rgba(244,114,182,0.05)] px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--flat-text-dim)]">{row.label}</span>
              <span className="text-xl text-[var(--neon-pink)]">{row.value}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--flat-text-ghost)]">{row.note}</p>
          </div>
        ))}
      </div>

      <p className="mb-2.5 mt-5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--neon-cyan)]">📡 Data Cables</p>
      <div className="space-y-2">
        {dataRows.map((row) => (
          <div key={row.label} className="rounded-lg border border-[rgba(0,212,255,0.12)] bg-[rgba(0,212,255,0.05)] px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--flat-text-dim)]">{row.label}</span>
              <span className="text-xl text-[var(--neon-cyan)]">{row.value}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--flat-text-ghost)]">{row.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
