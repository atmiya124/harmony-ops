import { Unit } from '@/lib/ledCalculator';

interface WallPreviewGridProps {
  cols: number;
  rows: number;
  unit: Unit;
}

const MAX_DISPLAY = 12; // cap columns/rows shown so huge grids stay legible

export default function WallPreviewGrid({ cols, rows }: WallPreviewGridProps) {
  if (cols === 0 || rows === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-[var(--flat-border)]">
        <p className="text-sm text-[var(--flat-text-ghost)]">Enter dimensions to preview</p>
      </div>
    );
  }

  const displayCols = Math.min(cols, MAX_DISPLAY);
  const displayRows = Math.min(rows, MAX_DISPLAY);
  const truncated = cols > MAX_DISPLAY || rows > MAX_DISPLAY;

  return (
    <div className="rounded-2xl bg-[#0a0a0f] p-4">
      <div className="flex items-center justify-center overflow-hidden rounded-lg bg-black/40 p-4">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: `repeat(${displayCols}, minmax(0, 1fr))`,
            width: `${Math.min(360, displayCols * 28)}px`,
            aspectRatio: `${displayCols} / ${displayRows}`,
          }}
        >
          {Array.from({ length: displayCols * displayRows }).map((_, i) => (
            <div key={i} className="rounded-[2px] border border-[rgba(0,212,255,0.4)] bg-[rgba(0,212,255,0.12)]" />
          ))}
        </div>
      </div>
      {truncated ? (
        <p className="mt-2 text-center text-[10px] text-[var(--flat-text-fainter)]">
          Preview simplified — {cols}×{rows} panels total
        </p>
      ) : null}
    </div>
  );
}
