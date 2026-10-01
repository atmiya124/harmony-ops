'use client';

import { ChevronDown } from 'lucide-react';
import { DATE_RANGES, isMonthRange, monthLabel, type DateRange } from '@/lib/dateRanges';

const PILL = 'rounded-full border py-2 text-xs font-bold transition';
const ACTIVE = 'border-white/20 bg-white/[0.14] text-white';
const IDLE = 'border-[var(--flat-border-strong)] text-[var(--flat-text-faint)] hover:text-[var(--flat-text-dim)]';

// The date-range filter that sits in one row above a screen's charts and
// scopes all of them: a month picker (the phone's own list picker, no
// calendar to fight) followed by rolling presets.
export default function RangeTabs({
  value,
  month,
  months,
  today,
  onChange,
}: {
  value: DateRange;
  // The month the picker shows — the selected one, or the last one picked
  // while a preset is active.
  month: string; // 'YYYY-MM'
  months: string[]; // choices, newest first
  today: string;
  onChange: (range: DateRange) => void;
}) {
  const monthActive = isMonthRange(value);
  return (
    <div role="group" aria-label="Date range" className="grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-1.5">
      <div className={`relative flex items-center justify-center gap-1 px-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/40 ${PILL} ${monthActive ? ACTIVE : IDLE}`}>
        <span className="truncate">{monthLabel(month, today)}</span>
        <ChevronDown size={14} className="shrink-0 opacity-70" />
        {/* Invisible native select over the pill. While a preset is active
            it has no value, so picking the month already shown still counts
            as a change. 16px stops iOS zooming in when it opens. */}
        <select
          value={monthActive ? month : ''}
          onChange={(e) => {
            if (e.target.value) onChange({ month: e.target.value });
          }}
          aria-label="Month"
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none text-[16px] opacity-0"
        >
          <option value="" disabled hidden>
            Month
          </option>
          {months.map((m) => (
            <option key={m} value={m}>
              {new Date(`${m}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </option>
          ))}
        </select>
      </div>
      {DATE_RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            aria-pressed={active}
            aria-label={r.label}
            onClick={() => onChange(r.key)}
            className={`${PILL} ${active ? ACTIVE : IDLE}`}
          >
            {r.short}
          </button>
        );
      })}
    </div>
  );
}
