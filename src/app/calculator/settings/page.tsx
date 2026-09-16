'use client';

import { useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';

export default function CalculatorSettingsPage() {
  const [settings, setSettings] = useState({
    defaultPixelPitch: '3.9',
    autoAttach: false,
    defaultMode: 'standard',
  });

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <div className="rounded-[28px] border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Calculator Settings</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Defaults</h2>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
            <ShieldCheck className="size-6" />
          </div>
        </div>

        <div className="space-y-5 rounded-[24px] border border-slate-700 bg-slate-950/50 p-5">
          <label className="block space-y-2 text-sm text-slate-300">
            <span>Default pixel pitch</span>
            <select
              value={settings.defaultPixelPitch}
              onChange={(e) => setSettings({ ...settings, defaultPixelPitch: e.target.value })}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            >
              <option value="2.5">2.5mm</option>
              <option value="3.9">3.9mm</option>
              <option value="4.8">4.8mm</option>
            </select>
          </label>

          <label className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
            <span>Auto attach to selected event</span>
            <button
              className={`relative h-7 w-12 rounded-full ${settings.autoAttach ? 'bg-cyan-500' : 'bg-slate-700'}`}
              onClick={() => setSettings({ ...settings, autoAttach: !settings.autoAttach })}
              type="button"
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${settings.autoAttach ? 'left-6' : 'left-1'}`}
              />
            </button>
          </label>

          <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400">
            <Save className="size-4" />
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
