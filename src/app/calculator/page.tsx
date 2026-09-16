'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Globe,
  GitBranch,
  Minus,
  Plus,
  Wand2,
  X,
} from 'lucide-react';
import {
  CUSTOM_PANEL,
  LED_PANELS,
  LedPanel,
  PENDING_LOAD_KEY,
  RATIO_OPTIONS,
  RatioKey,
  SAVED_CONFIGS_KEY,
  SavedConfig,
  UNIT_KEY,
  calculateStructure,
  calculateWall,
  fmt,
} from '@/lib/led-panels';
import { alpha, calcColors as c } from '@/lib/calc-theme';
import { initialEvents } from '@/lib/harmony-data';

type CustomFields = {
  pitchMm: string;
  widthMm: string;
  heightMm: string;
  pixelCols: string;
  pixelRows: string;
  weightPerM2: string;
  powerPerM2: string;
};

const defaultCustomFields: CustomFields = {
  pitchMm: '3.9',
  widthMm: '500',
  heightMm: '500',
  pixelCols: '128',
  pixelRows: '128',
  weightPerM2: '8.5',
  powerPerM2: '450',
};

const ALL_PANELS = [...LED_PANELS, CUSTOM_PANEL];

function categoryColor(category: LedPanel['category']) {
  if (category === 'indoor') return c.cyan;
  if (category === 'outdoor') return c.orange;
  return c.purple;
}

const WALL_MAX_W = 240;
const WALL_MAX_H = 180;

export default function CalculatorPage() {
  const [selectedPanelId, setSelectedPanelId] = useState('p39');
  const [customFields, setCustomFields] = useState<CustomFields>(defaultCustomFields);
  const [cols, setColsState] = useState(8);
  const [rows, setRowsState] = useState(5);
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [selectedRatio, setSelectedRatio] = useState<RatioKey>('free');
  const [showStructure, setShowStructure] = useState(false);
  const [attachedEvent, setAttachedEvent] = useState('None');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [panelModalOpen, setPanelModalOpen] = useState(false);
  const [configName, setConfigName] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const [widthText, setWidthText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [widthFocused, setWidthFocused] = useState(false);
  const [heightFocused, setHeightFocused] = useState(false);

  const isCustom = selectedPanelId === 'custom';
  const selectedPanel = ALL_PANELS.find((p) => p.id === selectedPanelId) ?? LED_PANELS[3];

  const effectivePanel: LedPanel = isCustom
    ? {
        ...CUSTOM_PANEL,
        pitchMm: parseFloat(customFields.pitchMm) || 3.9,
        widthMm: parseFloat(customFields.widthMm) || 500,
        heightMm: parseFloat(customFields.heightMm) || 500,
        pixelCols: parseInt(customFields.pixelCols) || 128,
        pixelRows: parseInt(customFields.pixelRows) || 128,
        weightPerM2: parseFloat(customFields.weightPerM2) || 8.5,
        powerPerM2: parseFloat(customFields.powerPerM2) || 450,
      }
    : selectedPanel;

  const result = useMemo(
    () => calculateWall(effectivePanel, Math.max(1, cols), Math.max(1, rows)),
    [effectivePanel, cols, rows],
  );
  const structure = useMemo(() => calculateStructure(result.totalPanels, cols, rows), [result.totalPanels, cols, rows]);

  const isMetric = unit === 'metric';
  const dimUnit = isMetric ? 'm' : 'ft';
  const panelWidthMm = effectivePanel.widthMm;
  const panelHeightMm = effectivePanel.heightMm;

  const derivedWidth = isMetric ? fmt(result.wallWidthM) : fmt(result.wallWidthFt);
  const derivedHeight = isMetric ? fmt(result.wallHeightM) : fmt(result.wallHeightFt);
  const displayWidth = widthFocused ? widthText : derivedWidth;
  const displayHeight = heightFocused ? heightText : derivedHeight;

  const ratioFor = (key: RatioKey) => RATIO_OPTIONS.find((r) => r.key === key)?.value ?? null;

  useEffect(() => {
    try {
      const storedUnit = window.localStorage.getItem(UNIT_KEY);
      if (storedUnit === 'imperial' || storedUnit === 'metric') setUnit(storedUnit);

      const pending = window.localStorage.getItem(PENDING_LOAD_KEY);
      if (pending) {
        const config: SavedConfig = JSON.parse(pending);
        setSelectedPanelId(config.panelId);
        setColsState(config.cols);
        setRowsState(config.rows);
        if (config.panelId === 'custom') {
          setCustomFields({
            pitchMm: String(config.panel.pitchMm),
            widthMm: String(config.panel.widthMm),
            heightMm: String(config.panel.heightMm),
            pixelCols: String(config.panel.pixelCols),
            pixelRows: String(config.panel.pixelRows),
            weightPerM2: String(config.panel.weightPerM2),
            powerPerM2: String(config.panel.powerPerM2),
          });
        }
        window.localStorage.removeItem(PENDING_LOAD_KEY);
      }
    } catch {
      // ignore malformed/blocked storage
    }
  }, []);

  const toggleUnit = () => {
    setUnit((prev) => {
      const next = prev === 'metric' ? 'imperial' : 'metric';
      try {
        window.localStorage.setItem(UNIT_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  const setCols = (newCols: number) => {
    const clamped = Math.max(1, Math.min(50, newCols));
    const ratio = ratioFor(selectedRatio);
    if (ratio !== null) {
      setRowsState(Math.max(1, Math.min(30, Math.round((clamped * panelWidthMm) / (ratio * panelHeightMm)))));
    }
    setColsState(clamped);
  };

  const setRows = (newRows: number) => {
    const clamped = Math.max(1, Math.min(30, newRows));
    const ratio = ratioFor(selectedRatio);
    if (ratio !== null) {
      setColsState(Math.max(1, Math.min(50, Math.round((clamped * panelHeightMm * ratio) / panelWidthMm))));
    }
    setRowsState(clamped);
  };

  const handleWidthBlur = () => {
    setWidthFocused(false);
    const val = parseFloat(widthText.replace(',', '.'));
    if (!isFinite(val) || val <= 0) return;
    const targetM = isMetric ? val : val / 3.28084;
    setCols(Math.round((targetM * 1000) / panelWidthMm));
  };

  const handleHeightBlur = () => {
    setHeightFocused(false);
    const val = parseFloat(heightText.replace(',', '.'));
    if (!isFinite(val) || val <= 0) return;
    const targetM = isMetric ? val : val / 3.28084;
    setRows(Math.round((targetM * 1000) / panelHeightMm));
  };

  const applyRatio = (key: RatioKey) => {
    setSelectedRatio(key);
    const ratio = ratioFor(key);
    if (ratio !== null) {
      setRowsState(Math.max(1, Math.min(30, Math.round((cols * panelWidthMm) / (ratio * panelHeightMm)))));
    }
  };

  const saveConfig = () => {
    const name = configName.trim();
    if (!name) return;
    const config: SavedConfig = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name,
      panelId: selectedPanelId,
      panel: effectivePanel,
      cols,
      rows,
      result,
      createdAt: Date.now(),
    };
    try {
      const raw = window.localStorage.getItem(SAVED_CONFIGS_KEY);
      const existing: SavedConfig[] = raw ? JSON.parse(raw) : [];
      window.localStorage.setItem(SAVED_CONFIGS_KEY, JSON.stringify([config, ...existing]));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch {
      // ignore
    }
    setSaveModalOpen(false);
    setConfigName('');
  };

  // Wall preview geometry — ported 1:1 from WallPreview.tsx
  const { wallW, wallH } = useMemo(() => {
    const safeW = Math.max(result.wallWidthM, 0.1);
    const safeH = Math.max(result.wallHeightM, 0.1);
    const scale = Math.min(WALL_MAX_W / safeW, WALL_MAX_H / safeH, 80);
    return {
      wallW: Math.max(Math.round(safeW * scale), 40),
      wallH: Math.max(Math.round(safeH * scale), 30),
    };
  }, [result.wallWidthM, result.wallHeightM]);

  const gridLines = useMemo(() => {
    const lines: { vertical: boolean; pos: number }[] = [];
    const maxEach = 20;
    const colCount = Math.min(cols - 1, maxEach);
    const rowCount = Math.min(rows - 1, maxEach);
    for (let i = 1; i <= colCount; i++) lines.push({ vertical: true, pos: Math.round((i * wallW) / cols) });
    for (let i = 1; i <= rowCount; i++) lines.push({ vertical: false, pos: Math.round((i * wallH) / rows) });
    return lines;
  }, [wallW, wallH, cols, rows]);

  const accentDim = alpha(c.primary, '60');
  const widthLabel = isMetric ? `${fmt(result.wallWidthM)} m` : `${fmt(result.wallWidthFt)} ft`;
  const heightLabel = isMetric ? `${fmt(result.wallHeightM)} m` : `${fmt(result.wallHeightFt)} ft`;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div className="rounded-[24px] border p-5 sm:p-7" style={{ backgroundColor: c.background, borderColor: c.border }}>
        {/* Brand header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-[60px] shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: c.primary }}>
              <span className="text-2xl font-bold tracking-tight text-white">HP</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: c.foreground }}>
                LED Wall Calculator
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: c.mutedForeground }}>
                by Harmony Production
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://harmonyproduction.ca"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold"
              style={{ borderColor: c.border, color: c.primary }}
            >
              <Globe className="size-4" />
              Visit Website
            </a>
            <button
              type="button"
              onClick={toggleUnit}
              className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold"
              style={{ borderColor: c.border, backgroundColor: c.card }}
            >
              <span style={{ color: isMetric ? c.primary : c.mutedForeground }}>m</span>
              <span style={{ color: c.border }}>|</span>
              <span style={{ color: !isMetric ? c.primary : c.mutedForeground }}>ft</span>
            </button>
          </div>
        </div>

        {/* LED panel */}
        <Section label="LED PANEL">
          <button
            type="button"
            onClick={() => setPanelModalOpen(true)}
            className="flex w-full items-center gap-3 rounded-[14px] border p-3.5 text-left"
            style={{ backgroundColor: c.card, borderColor: c.border }}
          >
            <span
              className="inline-flex min-w-[54px] items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-bold"
              style={{ backgroundColor: alpha(categoryColor(effectivePanel.category), '22'), color: categoryColor(effectivePanel.category) }}
            >
              {effectivePanel.name}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold" style={{ color: c.foreground }}>
                {effectivePanel.description}
              </span>
              {!isCustom && (
                <span className="block truncate text-xs" style={{ color: c.mutedForeground }}>
                  {effectivePanel.widthMm}×{effectivePanel.heightMm}mm &middot; {effectivePanel.pixelCols}×{effectivePanel.pixelRows}px &middot;{' '}
                  {effectivePanel.pitchMm}mm pitch
                </span>
              )}
            </span>
            <ChevronRight className="size-4 shrink-0" style={{ color: c.mutedForeground }} />
          </button>

          {isCustom && (
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-[14px] border p-4 sm:grid-cols-4" style={{ borderColor: alpha(c.purple, '40'), backgroundColor: alpha(c.purple, '0d') }}>
              <CustomField label="Pitch (mm)" value={customFields.pitchMm} onChange={(v) => setCustomFields((f) => ({ ...f, pitchMm: v }))} />
              <CustomField label="Width (mm)" value={customFields.widthMm} onChange={(v) => setCustomFields((f) => ({ ...f, widthMm: v }))} />
              <CustomField label="Height (mm)" value={customFields.heightMm} onChange={(v) => setCustomFields((f) => ({ ...f, heightMm: v }))} />
              <CustomField label="Weight (kg/m²)" value={customFields.weightPerM2} onChange={(v) => setCustomFields((f) => ({ ...f, weightPerM2: v }))} />
              <CustomField label="Pixel cols" value={customFields.pixelCols} onChange={(v) => setCustomFields((f) => ({ ...f, pixelCols: v }))} />
              <CustomField label="Pixel rows" value={customFields.pixelRows} onChange={(v) => setCustomFields((f) => ({ ...f, pixelRows: v }))} />
              <CustomField label="Power (W/m²)" value={customFields.powerPerM2} onChange={(v) => setCustomFields((f) => ({ ...f, powerPerM2: v }))} />
            </div>
          )}
        </Section>

        {/* Aspect ratio */}
        <Section label="ASPECT RATIO">
          <div className="flex gap-1.5">
            {RATIO_OPTIONS.map((opt) => {
              const active = selectedRatio === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => applyRatio(opt.key)}
                  className="flex-1 rounded-[10px] border py-2.5 text-center text-xs font-semibold"
                  style={{
                    backgroundColor: active ? c.primary : c.card,
                    borderColor: active ? c.primary : c.border,
                    color: active ? c.primaryForeground : c.mutedForeground,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Wall size */}
        <Section label="WALL SIZE">
          <div className="flex gap-2.5">
            <DimCard
              label="WIDTH"
              value={displayWidth}
              unit={dimUnit}
              focused={widthFocused}
              onFocus={() => {
                setWidthFocused(true);
                setWidthText(derivedWidth);
              }}
              onChange={setWidthText}
              onBlur={handleWidthBlur}
            />
            <DimCard
              label="HEIGHT"
              value={displayHeight}
              unit={dimUnit}
              focused={heightFocused}
              onFocus={() => {
                setHeightFocused(true);
                setHeightText(derivedHeight);
              }}
              onChange={setHeightText}
              onBlur={handleHeightBlur}
            />
          </div>
          <p className="-mt-1 text-[11px]" style={{ color: c.mutedForeground }}>
            Snaps to nearest whole panel — {panelWidthMm}×{panelHeightMm}mm each
          </p>
        </Section>

        {/* Grid configuration */}
        <Section label="GRID CONFIGURATION">
          <div className="flex items-stretch">
            <Stepper label="Columns" value={cols} unit="panels" onChange={setCols} min={1} max={50} />
            <div className="mx-3 w-px self-center" style={{ height: 68, backgroundColor: c.border }} />
            <Stepper label="Rows" value={rows} unit="panels" onChange={setRows} min={1} max={30} />
          </div>
        </Section>

        {/* Wall preview */}
        <div className="mb-5 rounded-[18px] border p-4" style={{ backgroundColor: c.card, borderColor: c.border }}>
          <p className="mb-4 text-[11px] font-semibold tracking-[1px]" style={{ color: c.mutedForeground }}>
            WALL PREVIEW
          </p>
          <div className="flex items-start justify-center gap-0 overflow-x-auto">
            <div className="relative flex shrink-0 flex-col items-center justify-center" style={{ width: 52, height: wallH }}>
              <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded" style={{ width: 1.5, height: wallH, backgroundColor: accentDim }} />
              <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded" style={{ width: 8, height: 1.5, backgroundColor: accentDim }} />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded" style={{ width: 8, height: 1.5, backgroundColor: accentDim }} />
              <span
                className="relative z-10 rounded px-1.5 py-0.5 text-xs font-bold"
                style={{ color: c.primary, backgroundColor: c.card }}
              >
                {heightLabel}
              </span>
            </div>

            <div className="flex shrink-0 flex-col items-start">
              <div className="relative overflow-hidden rounded-[3px] border-[1.5px]" style={{ width: wallW, height: wallH, borderColor: c.primary, backgroundColor: alpha(c.primary, '12') }}>
                {gridLines.map((line, i) =>
                  line.vertical ? (
                    <div key={i} className="absolute top-0" style={{ left: line.pos, width: 1, height: wallH, backgroundColor: alpha(c.primary, '28') }} />
                  ) : (
                    <div key={i} className="absolute left-0" style={{ top: line.pos, width: wallW, height: 1, backgroundColor: alpha(c.primary, '28') }} />
                  ),
                )}
              </div>

              <div className="relative flex items-center justify-center" style={{ width: wallW, height: 36 }}>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded" style={{ width: wallW, height: 1.5, backgroundColor: accentDim }} />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded" style={{ width: 1.5, height: 8, backgroundColor: accentDim }} />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 rounded" style={{ width: 1.5, height: 8, backgroundColor: accentDim }} />
                <span className="relative z-10 rounded px-2 py-0.5 text-xs font-bold" style={{ color: c.primary, backgroundColor: c.card }}>
                  {widthLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Wall dimensions */}
        <Section label="WALL DIMENSIONS">
          <div className="grid grid-cols-3 gap-2">
            <MetricCard label="Width" value={isMetric ? fmt(result.wallWidthM) : fmt(result.wallWidthFt)} unit={dimUnit} accent={c.cyan} />
            <MetricCard label="Height" value={isMetric ? fmt(result.wallHeightM) : fmt(result.wallHeightFt)} unit={dimUnit} accent={c.cyan} />
            <MetricCard label="Panels" value={String(result.totalPanels)} accent={c.primary} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <MetricCard
                label="Resolution"
                value={`${result.totalPixelsW.toLocaleString()}×${result.totalPixelsH.toLocaleString()}`}
                sub={`${(result.totalResolution / 1_000_000).toFixed(1)} MP total`}
                accent={c.purple}
              />
            </div>
            <MetricCard label="Ratio" value={result.aspectRatio} accent={c.purple} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Flight Boxes" value={String(Math.ceil(result.totalPanels / 8))} unit="boxes" accent={c.green} />
            <MetricCard label="Area" value={fmt(result.areaFt2, 1)} unit="ft²" accent={c.green} />
          </div>
        </Section>

        {/* Structure toggle */}
        <button
          type="button"
          onClick={() => setShowStructure((v) => !v)}
          className="mb-5 flex w-full items-center gap-3 rounded-[14px] border px-4 py-3.5"
          style={{ backgroundColor: c.card, borderColor: c.border }}
        >
          <span
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: showStructure ? alpha(c.primary, '22') : c.secondary }}
          >
            <GitBranch className="size-[18px]" style={{ color: showStructure ? c.primary : c.mutedForeground }} />
          </span>
          <span className="flex-1 text-left text-[15px] font-semibold" style={{ color: showStructure ? c.primary : c.foreground }}>
            Show Structure
          </span>
          {showStructure ? (
            <ChevronUp className="size-4" style={{ color: c.primary }} />
          ) : (
            <ChevronDown className="size-4" style={{ color: c.mutedForeground }} />
          )}
        </button>

        {showStructure && (
          <Section label="CABLES & CIRCUITS">
            <div className="overflow-hidden rounded-[14px] border" style={{ backgroundColor: c.card, borderColor: c.border }}>
              <StructureRow label="Flight Boxes Required" note="8 panels per flight box" value={structure.flightBoxes} accent={c.primary} last />
            </div>

            <p className="mt-1 text-[11px] font-semibold tracking-[1px]" style={{ color: c.mutedForeground }}>
              POWER CABLES
            </p>
            <div className="overflow-hidden rounded-[14px] border" style={{ backgroundColor: c.card, borderColor: c.border }}>
              <StructureRow label="Main Power Cables" note="1 per 15 panels" value={structure.mainPowerCables} accent={c.orange} />
              <StructureRow label="Power Jump Cables" note="horizontal, within rows" value={structure.powerJumpCables} accent={c.orange} />
              <StructureRow label="Power Extension Cables" note="vertical drops between rows" value={structure.powerExtensionCables} accent={c.orange} last />
            </div>

            <p className="mt-1 text-[11px] font-semibold tracking-[1px]" style={{ color: c.mutedForeground }}>
              DATA CABLES
            </p>
            <div className="overflow-hidden rounded-[14px] border" style={{ backgroundColor: c.card, borderColor: c.border }}>
              <StructureRow label="Data Main Cables" note="1 per column" value={structure.dataMainCables} accent={c.purple} />
              <StructureRow label="Data Jump Cables" note="vertical, within columns" value={structure.dataJumpCables} accent={c.purple} last />
            </div>
          </Section>
        )}

        {/* Attach to event (harmony-ops integration) */}
        <div className="mb-5 rounded-[14px] border p-4" style={{ backgroundColor: c.card, borderColor: c.border }}>
          <div className="mb-2 flex items-center gap-2" style={{ color: c.primary }}>
            <Wand2 className="size-4" />
            <span className="text-sm font-semibold">Attach to event</span>
          </div>
          <select
            value={attachedEvent}
            onChange={(e) => setAttachedEvent(e.target.value)}
            className="w-full rounded-xl border px-3 py-3 text-sm"
            style={{ backgroundColor: c.background, borderColor: c.border, color: c.foreground }}
          >
            <option value="None">None</option>
            {initialEvents.map((event) => (
              <option key={event.id} value={event.title}>
                {event.title}
              </option>
            ))}
          </select>
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={() => setSaveModalOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[16px] py-4 text-base font-semibold text-white"
          style={{ backgroundColor: c.primary }}
        >
          <Bookmark className="size-[18px]" />
          Save Configuration
        </button>
        {savedFlash && (
          <p className="mt-2 text-center text-xs" style={{ color: c.green }}>
            Configuration saved.
          </p>
        )}
      </div>

      {/* Save modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setSaveModalOpen(false)}>
          <div
            className="w-full max-w-sm rounded-[20px] border p-5"
            style={{ backgroundColor: c.card, borderColor: c.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-bold" style={{ color: c.foreground }}>
              Save Configuration
            </p>
            <p className="-mt-1 mb-1 text-[13px]" style={{ color: c.mutedForeground }}>
              Give this wall configuration a name
            </p>
            <input
              autoFocus
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveConfig()}
              placeholder="e.g. Main Stage Wall"
              className="mt-1 w-full rounded-xl border p-3.5 text-base outline-none"
              style={{ backgroundColor: c.background, borderColor: c.border, color: c.foreground }}
            />
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="flex-1 rounded-xl border py-3.5 text-[15px] font-semibold"
                style={{ borderColor: c.border, color: c.mutedForeground }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveConfig}
                disabled={!configName.trim()}
                className="flex-[2] rounded-xl py-3.5 text-[15px] font-semibold"
                style={{
                  backgroundColor: configName.trim() ? c.primary : c.muted,
                  color: configName.trim() ? c.primaryForeground : c.mutedForeground,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel picker modal */}
      {panelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={() => setPanelModalOpen(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-[24px] sm:rounded-[20px]"
            style={{ backgroundColor: c.background }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: c.border }}>
              <p className="text-lg font-bold" style={{ color: c.foreground }}>
                Select Panel
              </p>
              <button type="button" onClick={() => setPanelModalOpen(false)} className="p-1">
                <X className="size-[22px]" style={{ color: c.mutedForeground }} />
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto p-5">
              {(['indoor', 'outdoor', 'custom'] as const).map((cat) => {
                const panels = ALL_PANELS.filter((p) => p.category === cat);
                if (!panels.length) return null;
                return (
                  <div key={cat} className="mb-2 space-y-2">
                    <p className="mt-2 text-[11px] font-semibold tracking-[1.2px]" style={{ color: categoryColor(cat) }}>
                      {cat.toUpperCase()}
                    </p>
                    {panels.map((panel) => {
                      const isSelected = selectedPanelId === panel.id;
                      return (
                        <button
                          key={panel.id}
                          type="button"
                          onClick={() => {
                            setSelectedPanelId(panel.id);
                            setPanelModalOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-[14px] border p-3.5 text-left"
                          style={{
                            backgroundColor: isSelected ? alpha(c.primary, '18') : c.card,
                            borderColor: isSelected ? alpha(c.primary, '60') : c.border,
                          }}
                        >
                          <span
                            className="inline-flex min-w-[54px] items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-bold"
                            style={{ backgroundColor: alpha(categoryColor(panel.category), '22'), color: categoryColor(panel.category) }}
                          >
                            {panel.name}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold" style={{ color: c.foreground }}>
                              {panel.description}
                            </span>
                            <span className="block truncate text-[11px]" style={{ color: c.mutedForeground }}>
                              {panel.id !== 'custom'
                                ? `${panel.widthMm}×${panel.heightMm}mm · ${panel.pixelCols}×${panel.pixelRows}px · ${panel.pitchMm}mm pitch`
                                : 'Define your own panel specs'}
                            </span>
                          </span>
                          {isSelected && <Check className="size-5 shrink-0" style={{ color: c.primary }} />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 space-y-2.5">
      <p className="text-[11px] font-semibold tracking-[1px]" style={{ color: c.mutedForeground }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function DimCard({
  label,
  value,
  unit,
  focused,
  onFocus,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  unit: string;
  focused: boolean;
  onFocus: () => void;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label
      className="flex-1 space-y-1 rounded-[14px] border-[1.5px] px-3.5 py-3"
      style={{ backgroundColor: c.card, borderColor: focused ? c.primary : c.border }}
    >
      <span className="text-[10px] font-semibold tracking-[1px]" style={{ color: c.mutedForeground }}>
        {label}
      </span>
      <div className="flex items-end gap-1">
        <input
          value={value}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          inputMode="decimal"
          className="w-full bg-transparent text-[28px] font-bold outline-none"
          style={{ color: c.foreground }}
        />
        <span className="pb-0.5 text-[13px]" style={{ color: c.mutedForeground }}>
          {unit}
        </span>
      </div>
    </label>
  );
}

function Stepper({
  label,
  value,
  unit,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: c.mutedForeground }}>
        {label}
      </span>
      <div className="flex w-full items-center overflow-hidden rounded-[14px] border" style={{ backgroundColor: c.card, borderColor: c.border }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-[52px] w-11 items-center justify-center text-2xl disabled:opacity-30"
          style={{ color: c.primary }}
        >
          <Minus className="size-5" />
        </button>
        <div className="flex flex-1 flex-col items-center justify-center py-2">
          <span className="text-[28px] font-bold leading-none tracking-tight" style={{ color: c.foreground }}>
            {value}
          </span>
          {unit && (
            <span className="mt-1 text-[11px]" style={{ color: c.mutedForeground }}>
              {unit}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-[52px] w-11 items-center justify-center text-2xl disabled:opacity-30"
          style={{ color: c.primary }}
        >
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, sub, accent }: { label: string; value: string; unit?: string; sub?: string; accent: string }) {
  return (
    <div className="flex min-h-[88px] flex-col justify-center gap-0.5 rounded-2xl border p-3.5" style={{ backgroundColor: c.card, borderColor: c.border }}>
      <span className="mb-1 block size-1.5 rounded-full" style={{ backgroundColor: accent }} />
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: c.mutedForeground }}>
        {label}
      </p>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="truncate text-[26px] font-bold tracking-tight" style={{ color: accent }}>
          {value}
        </span>
        {unit && (
          <span className="mb-0.5 text-[13px] font-medium" style={{ color: c.mutedForeground }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <p className="mt-0.5 truncate text-[11px]" style={{ color: c.mutedForeground }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function StructureRow({ label, note, value, accent, last }: { label: string; note: string; value: number; accent: string; last?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5" style={!last ? { borderBottom: `1px solid ${c.border}` } : undefined}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: c.foreground }}>
          {label}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: c.mutedForeground }}>
          {note}
        </p>
      </div>
      <span
        className="flex h-9 min-w-11 items-center justify-center rounded-[10px] px-2.5 text-[18px] font-bold tracking-tight"
        style={{ backgroundColor: alpha(accent, '18'), color: accent }}
      >
        {value}
      </span>
    </div>
  );
}

function CustomField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1 text-xs" style={{ color: c.mutedForeground }}>
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="w-full rounded-xl border px-2.5 py-2 text-sm outline-none"
        style={{ backgroundColor: c.background, borderColor: c.border, color: c.foreground }}
      />
    </label>
  );
}
