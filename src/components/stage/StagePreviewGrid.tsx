import { Orientation, Unit, ftToUnit } from '@/lib/stageCalculator';

interface StagePreviewGridProps {
  panelsAlongLength: number;
  panelsAlongWidth: number;
  totalLengthFt: number;
  totalWidthFt: number;
  orientation: Orientation;
  unit: Unit;
}

const MAX_DISPLAY = 24;
const MAX_PREVIEW_W = 260;
const MAX_PREVIEW_H = 200;

export default function StagePreviewGrid({
  panelsAlongLength,
  panelsAlongWidth,
  totalLengthFt,
  totalWidthFt,
  orientation,
  unit,
}: StagePreviewGridProps) {
  const isEmpty = panelsAlongLength === 0 || panelsAlongWidth === 0;

  if (isEmpty) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-[var(--flat-border)]">
        <p className="text-sm text-[var(--flat-text-ghost)]">Enter dimensions to preview</p>
      </div>
    );
  }

  const truncated = panelsAlongLength * panelsAlongWidth > MAX_DISPLAY;
  const scaleDown = truncated ? Math.sqrt(MAX_DISPLAY / (panelsAlongLength * panelsAlongWidth)) : 1;
  const displayCols = Math.max(1, Math.min(panelsAlongLength, Math.round(panelsAlongLength * scaleDown)));
  const displayRows = Math.max(1, Math.min(panelsAlongWidth, Math.round(panelsAlongWidth * scaleDown)));

  const unitLabel = unit === 'm' ? 'm' : 'ft';
  const lengthDisplay = ftToUnit(totalLengthFt, unit).toFixed(unit === 'm' ? 2 : 1);
  const widthDisplay = ftToUnit(totalWidthFt, unit).toFixed(unit === 'm' ? 2 : 1);
  const cellAspect = orientation === 'horizontal' ? 2 : 0.5;

  let gridW = MAX_PREVIEW_W;
  let gridH = gridW / cellAspect / (displayCols / displayRows);
  if (gridH > MAX_PREVIEW_H) {
    gridH = MAX_PREVIEW_H;
    gridW = gridH * cellAspect * (displayCols / displayRows);
  }

  return (
    <div className="rounded-[20px] bg-[#0a0a0f] p-4">
      <p className="mb-3 ml-9 text-center text-[10px] text-white/40">{lengthDisplay} {unitLabel}</p>

      <div className="flex items-start">
        <div className="relative mr-2 flex w-7 shrink-0 items-center justify-center" style={{ height: gridH }}>
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/15" />
          <span className="relative z-10 -rotate-90 whitespace-nowrap bg-[#0a0a0f] px-1 text-[10px] text-white/40">
            {widthDisplay} {unitLabel}
          </span>
        </div>

        <div
          className="grid gap-[3px]"
          style={{ width: gridW, height: gridH, gridTemplateColumns: `repeat(${displayCols}, 1fr)`, gridTemplateRows: `repeat(${displayRows}, 1fr)` }}
        >
          {Array.from({ length: displayCols * displayRows }).map((_, i) => (
            <div key={i} className="rounded-[4px] border-[1.5px] border-[#5b9bf5] bg-[rgba(91,155,245,0.08)]" />
          ))}
        </div>
      </div>

      {truncated ? (
        <p className="mt-2.5 text-center text-[10px] tracking-wide text-[rgba(255,170,0,0.6)]">
          Preview simplified — {panelsAlongLength}×{panelsAlongWidth} panels total
        </p>
      ) : null}
    </div>
  );
}
