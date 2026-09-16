'use client';

import { ASPECT_PRESETS, AspectPreset } from '@/lib/ledCalculator';

interface AspectRatioSectionProps {
  lockedRatio: AspectPreset | null;
  onApplyPreset: (preset: AspectPreset) => void;
  customW: string;
  customH: string;
  onChangeCustomW: (v: string) => void;
  onChangeCustomH: (v: string) => void;
  onApplyCustom: () => void;
  onUnlock: () => void;
}

function ratioBoxSize(w: number, h: number) {
  const BOX_W = 28;
  const BOX_H = 16;
  const ratio = w / h;
  const containerRatio = BOX_W / BOX_H;
  if (ratio >= containerRatio) {
    return { width: BOX_W, height: BOX_W / ratio };
  }
  return { width: BOX_H * ratio, height: BOX_H };
}

export default function AspectRatioSection({
  lockedRatio,
  onApplyPreset,
  customW,
  customH,
  onChangeCustomW,
  onChangeCustomH,
  onApplyCustom,
  onUnlock,
}: AspectRatioSectionProps) {
  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {ASPECT_PRESETS.map((preset) => {
          const isActive = lockedRatio?.label === preset.label;
          const box = ratioBoxSize(preset.w, preset.h);
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 ${
                isActive ? 'border-[rgba(0,212,255,0.5)] bg-[rgba(0,212,255,0.1)]' : 'border-[var(--flat-border)] bg-[var(--flat-surface-alt)]'
              }`}
            >
              <span className="flex h-4 w-7 items-center justify-center">
                <span
                  className="rounded-[2px] border"
                  style={{ width: box.width, height: box.height, borderColor: isActive ? 'var(--neon-cyan)' : 'var(--flat-border-strong)' }}
                />
              </span>
              <span className={`text-sm font-medium ${isActive ? 'text-[var(--neon-cyan)]' : 'text-[var(--flat-text-dim)]'}`}>{preset.label}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--flat-text-fainter)]">Custom ratio</p>
      <div className="flex items-center gap-1.5">
        <input
          value={customW}
          onChange={(e) => onChangeCustomW(e.target.value)}
          inputMode="decimal"
          className="min-w-0 flex-1 rounded-md border border-[var(--flat-border-strong)] bg-[var(--flat-surface-input)] px-2.5 py-2 text-center text-sm text-white outline-none focus:border-[rgba(0,212,255,0.5)]"
        />
        <span className="text-lg font-light text-[var(--flat-text-fainter)]">:</span>
        <input
          value={customH}
          onChange={(e) => onChangeCustomH(e.target.value)}
          inputMode="decimal"
          className="min-w-0 flex-1 rounded-md border border-[var(--flat-border-strong)] bg-[var(--flat-surface-input)] px-2.5 py-2 text-center text-sm text-white outline-none focus:border-[rgba(0,212,255,0.5)]"
        />
        <button
          type="button"
          onClick={onApplyCustom}
          className="shrink-0 rounded-md border border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.12)] px-2.5 py-2 text-[11px] font-semibold text-[var(--neon-cyan)]"
        >
          Apply
        </button>
      </div>

      {lockedRatio ? (
        <button
          type="button"
          onClick={onUnlock}
          className="mt-3 w-full rounded-md border border-[var(--flat-border)] py-2 text-[11px] text-[var(--flat-text-fainter)]"
        >
          Unlock ratio — edit freely
        </button>
      ) : null}
    </div>
  );
}
