'use client';

import { useCallback, useMemo, useState } from 'react';
import QuickSizeChips from '@/components/shared/QuickSizeChips';
import DimensionInput from '@/components/led/DimensionInput';
import AspectRatioSection from '@/components/led/AspectRatioSection';
import PanelInfoSection from '@/components/led/PanelInfoSection';
import Accordion from '@/components/ui/Accordion';
import WallPreviewGrid from '@/components/led/WallPreviewGrid';
import ResultCardGrid from '@/components/shared/ResultCardGrid';
import CablesSection from '@/components/led/CablesSection';
import PricingSection from '@/components/led/PricingSection';
import { calculateLedWall, mmToUnit, unitToMm, fmt, AspectPreset, QUICK_SIZES, Unit } from '@/lib/ledCalculator';

export default function CalculatorPage() {
  const [unit, setUnit] = useState<Unit>('ft');
  const [widthInput, setWidthInput] = useState('20');
  const [heightInput, setHeightInput] = useState('10');
  const [lockedRatio, setLockedRatio] = useState<AspectPreset | null>(null);
  const [customW, setCustomW] = useState('16');
  const [customH, setCustomH] = useState('9');

  const widthVal = parseFloat(widthInput) || 0;
  const heightVal = parseFloat(heightInput) || 0;
  const isValid = widthVal > 0 && heightVal > 0;

  const result = useMemo(() => calculateLedWall(widthVal, heightVal, unit), [widthVal, heightVal, unit]);

  const handleWidthChange = useCallback(
    (v: string) => {
      setWidthInput(v);
      if (lockedRatio) {
        const w = parseFloat(v) || 0;
        setHeightInput(fmt((w * lockedRatio.h) / lockedRatio.w));
      }
    },
    [lockedRatio],
  );

  const handleHeightChange = useCallback(
    (v: string) => {
      setHeightInput(v);
      if (lockedRatio) {
        const h = parseFloat(v) || 0;
        setWidthInput(fmt((h * lockedRatio.w) / lockedRatio.h));
      }
    },
    [lockedRatio],
  );

  const applyQuickSize = useCallback((q: (typeof QUICK_SIZES)[number]) => {
    setUnit(q.u);
    setWidthInput(String(q.w));
    setHeightInput(String(q.h));
    setLockedRatio(null);
  }, []);

  const applyPreset = useCallback(
    (preset: AspectPreset) => {
      if (lockedRatio?.label === preset.label) {
        setLockedRatio(null);
        return;
      }
      setLockedRatio(preset);
      const w = parseFloat(widthInput) || 0;
      if (w > 0) setHeightInput(fmt((w * preset.h) / preset.w));
    },
    [lockedRatio, widthInput],
  );

  const applyCustomRatio = useCallback(() => {
    const cw = parseFloat(customW) || 0;
    const ch = parseFloat(customH) || 0;
    if (cw <= 0 || ch <= 0) return;
    const preset: AspectPreset = { label: `${customW}:${customH}`, w: cw, h: ch };
    setLockedRatio(preset);
    const w = parseFloat(widthInput) || 0;
    if (w > 0) setHeightInput(fmt((w * ch) / cw));
  }, [customW, customH, widthInput]);

  const unlockRatio = useCallback(() => setLockedRatio(null), []);

  const handleUnitChange = useCallback(
    (newUnit: Unit) => {
      const wMm = unitToMm(parseFloat(widthInput) || 0, unit);
      const hMm = unitToMm(parseFloat(heightInput) || 0, unit);
      setWidthInput(fmt(mmToUnit(wMm, newUnit)));
      setHeightInput(fmt(mmToUnit(hMm, newUnit)));
      setUnit(newUnit);
    },
    [unit, widthInput, heightInput],
  );

  return (
    <div>
      {/* Dimensions */}
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

        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--flat-text-faint)]">Screen Dimensions</p>
        <QuickSizeChips items={QUICK_SIZES} onSelect={applyQuickSize} />

        <div className="grid grid-cols-2 gap-3">
          <DimensionInput label={`Width (${unit})`} value={widthInput} onChangeText={handleWidthChange} unit={unit} />
          <DimensionInput label={`Height (${unit})`} value={heightInput} onChangeText={handleHeightChange} unit={unit} />
        </div>

        {isValid && result ? (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] px-3 py-2.5">
            <span className="text-[11px] text-[var(--flat-text-faint)]">Actual screen size</span>
            <span className="text-xs font-medium text-[var(--neon-green)]">
              {result.actualWidthDisplay} × {result.actualHeightDisplay} {unit}
            </span>
          </div>
        ) : null}
      </div>

      <Accordion title="Aspect Ratio" subtitle={lockedRatio ? `${lockedRatio.label} locked` : 'Free-form — no ratio locked'}>
        <AspectRatioSection
          lockedRatio={lockedRatio}
          onApplyPreset={applyPreset}
          customW={customW}
          customH={customH}
          onChangeCustomW={setCustomW}
          onChangeCustomH={setCustomH}
          onApplyCustom={applyCustomRatio}
          onUnlock={unlockRatio}
        />
      </Accordion>

      <Accordion title="Panel — P2.6 Standard" subtitle="500×500mm · 192×192px · 200W/panel">
        <PanelInfoSection />
      </Accordion>

      {/* Wall Preview */}
      <div className="mb-4 rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--flat-text-faint)]">Wall Preview</p>
          <div className="flex items-center gap-2.5">
            {lockedRatio ? (
              <span className="rounded border border-[rgba(0,212,255,0.15)] bg-[rgba(0,212,255,0.08)] px-2 py-0.5 text-xs text-[rgba(0,212,255,0.7)]">
                {lockedRatio.label}
              </span>
            ) : null}
            {isValid && result ? (
              <span className="text-xs text-[var(--neon-orange)]">
                {result.colsCeil} × {result.rowsCeil} panels
              </span>
            ) : null}
          </div>
        </div>
        <WallPreviewGrid cols={isValid && result ? result.colsCeil : 0} rows={isValid && result ? result.rowsCeil : 0} unit={unit} />
      </div>

      {isValid && result ? (
        <ResultCardGrid
          cards={[
            {
              label: 'Total Panels',
              value: result.totalPanelsCeil.toString(),
              sub: `${result.colsCeil} cols × ${result.rowsCeil} rows`,
              color: 'var(--neon-cyan)',
              icon: '▦',
              large: true,
            },
            {
              label: 'Total Resolution',
              value: `${result.totalPixelsW.toLocaleString()} × ${result.totalPixelsH.toLocaleString()}`,
              sub: `${result.totalMegapixels.toFixed(2)} MP`,
              color: 'var(--neon-green)',
              icon: '⬛',
              large: true,
            },
            {
              label: 'Aspect Ratio',
              value: result.aspectRatioStr,
              sub: `${result.colsCeil}:${result.rowsCeil} panels`,
              color: 'var(--neon-purple)',
              icon: '⬜',
              large: true,
            },
            {
              label: 'Screen Area',
              value: `${result.sqFt.toFixed(1)} sq ft`,
              sub: `${result.sqM.toFixed(2)} m²`,
              color: 'var(--neon-mint)',
              icon: '📐',
              large: true,
            },
            {
              label: 'Flight Boxes',
              value: `${result.flightBoxes} boxes`,
              sub: `8 panels/box · ${result.totalPanelsCeil} panels total`,
              color: 'var(--neon-orange)',
              icon: '📦',
              large: true,
            },
            {
              label: 'Power & Circuits',
              value: `${result.totalPowerKW.toFixed(1)} kW`,
              sub: `${result.ampere16A}× 16A or ${result.ampere32A}× 32A @ 230V`,
              color: 'var(--neon-pink)',
              icon: '⚡',
              large: true,
            },
          ]}
        />
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-12 text-center">
          <p className="mb-3 text-3xl opacity-20">▦</p>
          <p className="text-sm text-[var(--flat-text-ghost)]">Enter width and height above to see your wall</p>
          <p className="mt-2 text-xs text-white/15">Or tap a quick size above</p>
        </div>
      )}

      {isValid && result ? (
        <Accordion title="Cables & Circuits" subtitle={`${result.powerMainCables} main power · ${result.dataMainCables} data cables`}>
          <CablesSection results={result} />
        </Accordion>
      ) : null}

      {isValid && result ? (
        <Accordion
          title="Pricing"
          subtitle={`$${(result.sqFt * 17).toLocaleString('en-US', { maximumFractionDigits: 0 })} estimated total`}
          defaultOpen
        >
          <PricingSection results={result} />
        </Accordion>
      ) : null}
    </div>
  );
}
