'use client';

import { useState } from 'react';
import { Palette, Layers3, Ruler, Sparkles } from 'lucide-react';

const stageConfigs = [
  { name: '8x8 Stage', footprint: '64 sq ft', load: '1.0 kW', color: 'bg-cyan-500/15 text-cyan-200' },
  { name: '8x12 Stage', footprint: '96 sq ft', load: '1.5 kW', color: 'bg-violet-500/15 text-violet-200' },
  { name: '12x16 Stage', footprint: '192 sq ft', load: '2.6 kW', color: 'bg-emerald-500/15 text-emerald-200' },
];

export default function StagePage() {
  const [selected, setSelected] = useState(stageConfigs[1]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="rounded-[28px] border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 flex items-center justify-between py-1">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Stage</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Build layout</h2>
          </div>
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-3 text-violet-300">
            <Layers3 className="size-6" />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            {stageConfigs.map((config) => (
              <button
                key={config.name}
                onClick={() => setSelected(config)}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                  selected.name === config.name
                    ? 'border-violet-400 bg-violet-500/10'
                    : 'border-slate-700 bg-slate-950/40 hover:border-slate-600'
                }`}
              >
                <div>
                  <p className="text-lg font-semibold text-white">{config.name}</p>
                  <p className="text-sm text-slate-400">{config.footprint}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${config.color}`}>{config.load}</span>
              </button>
            ))}
          </div>

          <div className="rounded-[24px] border border-slate-700 bg-gradient-to-br from-violet-500/10 to-slate-900 p-5">
            <div className="mb-5 flex items-center gap-2 text-violet-200">
              <Ruler className="size-5" />
              <span className="text-sm uppercase tracking-[0.2em]">Selected</span>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Style</span>
                <span className="font-semibold text-white">{selected.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Footprint</span>
                <span className="font-semibold text-white">{selected.footprint}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Power draw</span>
                <span className="font-semibold text-white">{selected.load}</span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 p-4 text-sm text-slate-300">
              <div className="mb-2 flex items-center gap-2 text-emerald-300">
                <Sparkles className="size-4" />
                Add-on layout
              </div>
              This stage is ready for risers, underrig, and branded skirting.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
