'use client';

import { useEffect, useState } from 'react';
import { Check, DollarSign, RotateCcw } from 'lucide-react';
import { getPricingSettings, savePricingSettings } from '@/lib/pricingApi';
import { DEFAULT_LED_RATE } from '@/lib/ledCalculator';
import { DEFAULT_STAGE_RATE } from '@/lib/stageCalculator';
import ErrorState from '@/components/ui/ErrorState';

export default function CalculatorSettingsPage() {
  const [ledRate, setLedRate] = useState('');
  const [stageRate, setStageRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPricingSettings()
      .then((s) => {
        setLedRate(String(s.ledPricePerSqft));
        setStageRate(String(s.stagePricePerPanel));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load pricing settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const led = parseFloat(ledRate);
    const stage = parseFloat(stageRate);
    if (!Number.isFinite(led) || led < 0 || !Number.isFinite(stage) || stage < 0) {
      setError('Enter valid, non-negative rates.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePricingSettings({ ledPricePerSqft: led, stagePricePerPanel: stage });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing settings.');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setLedRate(String(DEFAULT_LED_RATE));
    setStageRate(String(DEFAULT_STAGE_RATE));
  };

  if (loading) return <p className="py-20 text-center text-sm text-[var(--flat-text-ghost)]">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xl font-bold text-white">Settings</p>
        <p className="mt-0.5 text-xs text-[var(--flat-text-faint)]">Manage pricing used across the LED and stage calculators</p>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Pricing</p>

        <RateField label="LED screen rate" unit="/ sq ft" value={ledRate} onChange={setLedRate} color="var(--neon-cyan)" />
        <div className="h-4" />
        <RateField label="Stage panel rate" unit="/ panel" value={stageRate} onChange={setStageRate} color="var(--neon-orange)" />

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={resetDefaults}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--flat-border)] px-4 py-3 text-xs font-bold text-[var(--flat-text-dim)]"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--neon-green)] py-3 text-[13px] font-bold text-[#0a0a0a] disabled:opacity-50"
          >
            <Check size={16} /> {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>

        <p className="mt-3 text-[10px] leading-tight text-[var(--flat-text-ghost)]">
          These rates apply to every new estimate across the LED and stage calculators.
        </p>
      </div>
    </div>
  );
}

function RateField({
  label,
  unit,
  value,
  onChange,
  color,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-[var(--flat-text-dim)]">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-input)] px-3 py-2.5">
        <DollarSign size={14} style={{ color }} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
        />
        <span className="shrink-0 text-[11px] text-[var(--flat-text-faint)]">{unit}</span>
      </div>
    </label>
  );
}
