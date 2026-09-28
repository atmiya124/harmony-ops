'use client';

import { DateRangeKey, DATE_RANGES } from '@/lib/dateRanges';

// The date-range filter that sits in one row above a screen's charts and
// scopes all of them. Presets only — no calendar to fight on a phone.
export default function RangeTabs({ value, onChange }: { value: DateRangeKey; onChange: (range: DateRangeKey) => void }) {
  return (
    <div role="tablist" aria-label="Date range" className="grid grid-cols-6 gap-1.5">
      {DATE_RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={r.label}
            onClick={() => onChange(r.key)}
            className={`rounded-full border py-2 text-xs font-bold transition ${
              active
                ? 'border-white/20 bg-white/[0.14] text-white'
                : 'border-[var(--flat-border-strong)] text-[var(--flat-text-faint)] hover:text-[var(--flat-text-dim)]'
            }`}
          >
            {r.short}
          </button>
        );
      })}
    </div>
  );
}
