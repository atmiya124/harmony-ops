'use client';

import { Save, Users } from 'lucide-react';
import { useState } from 'react';

export default function EventSettingsPage() {
  const [settings, setSettings] = useState({
    companyName: 'Harmony Production',
    partnerEmails: 'partners@harmonyproduction.ca, ops@harmonyproduction.ca',
    reminder7Days: true,
    reminder2Days: true,
    reminder1Day: true,
  });

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <div className="rounded-[28px] border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Event Settings</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Partner automation</h2>
          </div>
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-300">
            <Users className="size-6" />
          </div>
        </div>

        <div className="space-y-5 rounded-[24px] border border-slate-700 bg-slate-950/50 p-5">
          <label className="block space-y-2 text-sm text-slate-300">
            <span>Company name</span>
            <input
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-300">
            <span>Partner emails</span>
            <textarea
              rows={3}
              value={settings.partnerEmails}
              onChange={(e) => setSettings({ ...settings, partnerEmails: e.target.value })}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            />
          </label>

          <div className="space-y-3">
            {[
              ['reminder7Days', '7 days before event'],
              ['reminder2Days', '2 days before event'],
              ['reminder1Day', '1 day before event'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
                <span>{label}</span>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, [key]: !settings[key as keyof typeof settings] })}
                  className={`relative h-7 w-12 rounded-full ${settings[key as keyof typeof settings] ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${settings[key as keyof typeof settings] ? 'left-6' : 'left-1'}`}
                  />
                </button>
              </label>
            ))}
          </div>

          <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">
            <Save className="size-4" />
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
