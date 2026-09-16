'use client';

import { useCallback, useMemo, useState } from 'react';
import QuickSizeChips from '@/components/shared/QuickSizeChips';
import DimensionInput from '@/components/led/DimensionInput';
import Accordion from '@/components/ui/Accordion';
import ResultCardGrid from '@/components/shared/ResultCardGrid';
import StagePreviewGrid from '@/components/stage/StagePreviewGrid';
import StagePanelInfoSection from '@/components/stage/StagePanelInfoSection';
import StagePricingSection from '@/components/stage/StagePricingSection';
import { calculateStage, calculateStagePrice, ftToUnit, unitToFt, fmt, STAGE_QUICK_SIZES, Orientation, Unit } from '@/lib/stageCalculator';

export default function StageCalculatorPage() {
  const [unit, setUnit] = useState<Unit>('ft');
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [lengthInput, setLengthInput] = useState('8');
  const [widthInput, setWidthInput] = useState('4');

  const lengthVal = parseFloat(lengthInput) || 0;
  const widthVal = parseFloat(widthInput) || 0;
  const isValid = lengthVal > 0 && widthVal > 0;

  const result = useMemo(() => calculateStage(lengthVal, widthVal, unit, orientation), [lengthVal, widthVal, unit, orientation]);

  const applyQuickSize = useCallback((q: (typeof STAGE_QUICK_SIZES)[number]) => {
    setUnit(q.u);
    setLengthInput(String(q.length));
    setWidthInput(String(q.width));
  }, []);

  const handleUnitChange = useCallback(
    (newUnit: Unit) => {
      const lengthFt = unitToFt(parseFloat(lengthInput) || 0, unit);
      const widthFt = unitToFt(parseFloat(widthInput) || 0, unit);
      setLengthInput(fmt(ftToUnit(lengthFt, newUnit)));
      setWidthInput(fmt(ftToUnit(widthFt, newUnit)));
      setUnit(newUnit);
    },
    [unit, lengthInput, widthInput],
  );

  return (
    <div>
      <div className="mb-4 rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
        <div className="mb-4 inline-flex rounded-md border border-[var(--flat-border)] bg-[var(--flat-surface-input)] p-0.5">
          {(['ft', 'm'] as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => handleUnitChange(u)}
              className={`rounded px-3.5 py-1.5 text-xs font-medium tracking-wide ${
                unit === u ? 'bg-white/[0.12] text-white' : 'text-[var(--flat-text-faint)]'
              }`}
            >
              {u === 'm' ? 'Meters' : 'Feet'}
            </button>
          ))}
        </div>

        <div className="mb-4 flex gap-2">
          {(['horizontal', 'vertical'] as Orientation[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrientation(o)}
              className={`flex-1 rounded-md border py-2 text-xs font-medium ${
                orientation === o
                  ? 'border-[rgba(91,155,245,0.4)] bg-[rgba(91,155,245,0.15)] text-[#5b9bf5]'
                  : 'border-[var(--flat-border)] bg-[var(--flat-surface-input)] text-[var(--flat-text-faint)]'
              }`}
            >
              {o === 'horizontal' ? '↔ Horizontal' : '↕ Vertical'}
            </button>
          ))}
        </div>

        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--flat-text-faint)]">Stage Dimensions</p>
        <QuickSizeChips items={STAGE_QUICK_SIZES} onSelect={applyQuickSize} />

        <div className="grid grid-cols-2 gap-3">
          <DimensionInput label={`Length (${unit})`} value={lengthInput} onChangeText={setLengthInput} unit={unit} />
          <DimensionInput label={`Width (${unit})`} value={widthInput} onChangeText={setWidthInput} unit={unit} />
        </div>

        {isValid && result ? (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] px-3 py-2.5">
            <span className="text-[11px] text-[var(--flat-text-faint)]">Actual stage size</span>
            <span className="text-xs font-medium text-[var(--neon-green)]">
              {fmt(ftToUnit(result.totalLengthFt, unit))} × {fmt(ftToUnit(result.totalWidthFt, unit))} {unit}
            </span>
          </div>
        ) : null}
      </div>

      <Accordion title="Platform — 4×8 Standard" subtitle="4 legs · 2×8' + 2×4' support per panel">
        <StagePanelInfoSection />
      </Accordion>

      <div className="mb-4 rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--flat-text-faint)]">Stage Preview</p>
          {isValid && result ? (
            <span className="text-xs text-[var(--neon-orange)]">
              {result.panelsAlongLength} × {result.panelsAlongWidth} panels
            </span>
          ) : null}
        </div>
        <StagePreviewGrid
          panelsAlongLength={isValid && result ? result.panelsAlongLength : 0}
          panelsAlongWidth={isValid && result ? result.panelsAlongWidth : 0}
          totalLengthFt={result?.totalLengthFt ?? 0}
          totalWidthFt={result?.totalWidthFt ?? 0}
          orientation={orientation}
          unit={unit}
        />
      </div>

      {isValid && result ? (
        <ResultCardGrid
          cards={[
            { label: 'Total Panels', value: result.totalPanels.toString(), color: 'var(--neon-cyan)', icon: '▦', large: true },
            { label: 'Legs', value: result.legs.toString(), color: 'var(--neon-green)', icon: '⊥', large: true },
            { label: "8' Support", value: result.support8ft.toString(), color: 'var(--neon-purple)', icon: '━', large: true },
            { label: "4' Support", value: result.support4ft.toString(), color: 'var(--neon-mint)', icon: '┃', large: true },
            { label: 'Stage Area', value: `${result.areaSqFt.toFixed(0)} sq ft`, color: 'var(--neon-orange)', icon: '📐', large: true },
          ]}
        />
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-12 text-center">
          <p className="mb-3 text-3xl opacity-20">▦</p>
          <p className="text-sm text-[var(--flat-text-ghost)]">Enter length and width above to see your stage</p>
          <p className="mt-2 text-xs text-white/15">Or tap a quick size above</p>
        </div>
      )}

      {isValid && result ? (
        <Accordion
          title="Pricing"
          subtitle={`$${calculateStagePrice(result.totalPanels).toLocaleString('en-US', { maximumFractionDigits: 0 })} estimated total`}
          defaultOpen
        >
          <StagePricingSection results={result} />
        </Accordion>
      ) : null}
    </div>
  );
}
