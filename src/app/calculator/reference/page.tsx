'use client';

import { useState } from 'react';
import { BookOpen, Eye, Info, Zap } from 'lucide-react';
import { LED_PANELS } from '@/lib/led-panels';
import { alpha, calcColors as c } from '@/lib/calc-theme';

type Tab = 'panels' | 'viewing' | 'power';

const viewingRules = [
  { pitch: 'P1.9 – P2.6', range: '1 – 5 m', use: 'Broadcast TV, studio cyc walls, close-proximity screens' },
  { pitch: 'P2.9', range: '3 – 8 m', use: 'Corporate events, conferences, stage backdrops' },
  { pitch: 'P3.9', range: '4 – 12 m', use: 'Concerts, live events, rental stage walls' },
  { pitch: 'P4.8 – P5.9', range: '5 – 20 m', use: 'Large venues, sports events, outdoor festivals' },
  { pitch: 'P7.8+', range: '8 – 40 m', use: 'Stadiums, outdoor billboards, facade displays' },
];

const circuits = [
  { amps: '20A @ 120V', watts: '2,400 W', note: 'US standard circuit' },
  { amps: '20A @ 208V', watts: '4,160 W', note: 'US 3-phase (single leg)' },
  { amps: '16A @ 230V', watts: '3,680 W', note: 'EU standard circuit' },
  { amps: '32A @ 230V', watts: '7,360 W', note: 'EU high-power circuit' },
  { amps: '63A @ 230V', watts: '14,490 W', note: 'EU industrial' },
];

const tips = [
  'Always add 20–30% headroom to your power calculations',
  'LED walls draw max power at full-white (100% brightness)',
  'Typical show brightness is 30–50% — real draw is lower',
  'Use separate circuits for LED wall vs. lighting and audio',
  'Factor in distro losses (~5%) for long cable runs',
  'Check venue panel capacity before planning large walls',
];

export default function ReferencePage() {
  const [tab, setTab] = useState<Tab>('panels');

  const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
    { key: 'panels', label: 'Panels', icon: BookOpen },
    { key: 'viewing', label: 'Viewing', icon: Eye },
    { key: 'power', label: 'Power', icon: Zap },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div className="rounded-[24px] border p-5 sm:p-7" style={{ backgroundColor: c.background, borderColor: c.border }}>
        <div className="mb-1">
          <h1 className="text-[32px] font-bold tracking-tight" style={{ color: c.foreground }}>
            Reference
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: c.mutedForeground }}>
            Specs & Guidelines
          </p>
        </div>

        <div className="my-5 flex gap-1 rounded-[14px] border p-1" style={{ backgroundColor: c.card, borderColor: c.border }}>
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-semibold"
              style={{ backgroundColor: tab === key ? alpha(c.primary, '18') : 'transparent', color: tab === key ? c.primary : c.mutedForeground }}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'panels' && (
          <div className="space-y-3">
            <p className="text-[13px]" style={{ color: c.mutedForeground }}>
              Industry-standard rental panels with typical specs.
            </p>
            {LED_PANELS.map((panel) => {
              const accent = panel.category === 'indoor' ? c.cyan : c.orange;
              return (
                <div key={panel.id} className="space-y-3 rounded-[14px] border p-3.5" style={{ backgroundColor: c.card, borderColor: c.border }}>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex min-w-[56px] items-center justify-center rounded-[10px] px-3 py-2 text-sm font-bold"
                      style={{ backgroundColor: alpha(accent, '22'), color: accent }}
                    >
                      {panel.name}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: c.foreground }}>
                        {panel.description}
                      </p>
                      <span
                        className="mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.5px]"
                        style={{ backgroundColor: alpha(accent, '15'), color: accent }}
                      >
                        {panel.category}
                      </span>
                    </div>
                  </div>
                  <div className="border-t" style={{ borderColor: c.border, marginInline: -14 }} />
                  <div className="flex flex-wrap gap-3">
                    <RefStat label="Panel Size" value={`${panel.widthMm}×${panel.heightMm}mm`} />
                    <RefStat label="Pixels" value={`${panel.pixelCols}×${panel.pixelRows}`} />
                    <RefStat label="Pitch" value={`${panel.pitchMm}mm`} />
                    <RefStat label="Opt. Viewing" value={`~${panel.pitchMm.toFixed(1)}m`} />
                    <RefStat label="Weight" value={`${panel.weightPerM2} kg/m²`} />
                    <RefStat label="Power" value={`${panel.powerPerM2} W/m²`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'viewing' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-xl border p-3" style={{ backgroundColor: alpha(c.cyan, '12'), borderColor: alpha(c.cyan, '40') }}>
              <Info className="mt-0.5 size-[18px] shrink-0" style={{ color: c.cyan }} />
              <p className="text-[13px] leading-[18px]" style={{ color: c.foreground }}>
                Rule of thumb: optimal viewing distance (meters) ≈ pixel pitch (mm). E.g. P3.9 → optimal at ~4 m.
              </p>
            </div>
            {viewingRules.map((r) => (
              <div key={r.pitch} className="rounded-[14px] border p-3.5" style={{ backgroundColor: c.card, borderColor: c.border }}>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex min-w-20 items-center justify-center rounded-[10px] px-2.5 py-2 text-[13px] font-bold"
                    style={{ backgroundColor: alpha(c.primary, '22'), color: c.primary }}
                  >
                    {r.pitch}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold tracking-tight" style={{ color: c.foreground }}>
                      {r.range}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: c.mutedForeground }}>
                      {r.use}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'power' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[1px]" style={{ color: c.mutedForeground }}>
                CIRCUIT CAPACITIES
              </p>
              {circuits.map((circuit) => (
                <div key={circuit.amps} className="flex overflow-hidden rounded-xl border" style={{ backgroundColor: c.card, borderColor: c.border }}>
                  <div className="flex w-[130px] items-center justify-center border-r px-3.5 py-3.5" style={{ borderColor: c.border }}>
                    <span className="text-sm font-semibold" style={{ color: c.orange }}>
                      {circuit.amps}
                    </span>
                  </div>
                  <div className="flex-1 px-3.5 py-3">
                    <p className="text-base font-bold" style={{ color: c.foreground }}>
                      {circuit.watts}
                    </p>
                    <p className="text-xs" style={{ color: c.mutedForeground }}>
                      {circuit.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[1px]" style={{ color: c.mutedForeground }}>
                PLANNING TIPS
              </p>
              <ul className="space-y-2.5">
                {tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2.5 text-[13px] leading-5" style={{ color: c.foreground }}>
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.green }} />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RefStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[30%] flex-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.3px]" style={{ color: c.mutedForeground }}>
        {label}
      </p>
      <p className="text-sm font-semibold" style={{ color: c.foreground }}>
        {value}
      </p>
    </div>
  );
}
