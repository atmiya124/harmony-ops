'use client';

import { Calendar } from 'lucide-react';

// A compact date "chip" that opens the browser's native date picker when
// tapped or clicked anywhere on it. The native <input type="date"> is laid
// invisibly over the whole chip and receives the tap itself:
//   - Phones open their picker for a direct tap on a date input. (iOS Safari
//     ignores showPicker() on date inputs without throwing, so the input
//     must never be pointer-events: none.)
//   - Desktop browsers only open it from the input's own calendar icon, so
//     a mouse/trackpad click also calls showPicker().
export default function DateChip({
  value,
  label,
  onChange,
  min,
  max,
  ariaLabel,
  className = '',
}: {
  value: string; // YYYY-MM-DD
  label: string; // what the chip shows, e.g. "Today"
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className="relative rounded-2xl has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/40">
      <span aria-hidden className={`flex w-full items-center gap-2.5 text-left ${className}`}>
        <Calendar size={16} className="shrink-0 text-white/45" />
        <span className="text-xs font-bold text-white">{label}</span>
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        onClick={(e) => {
          if (!window.matchMedia('(pointer: fine)').matches) return; // touch: native tap opens it
          try {
            e.currentTarget.showPicker();
          } catch {
            // Already open, or no showPicker(): the native click still applies.
          }
        }}
        aria-label={`${ariaLabel}: ${label}. Change date`}
        // 16px stops iOS zooming the page when the input takes focus.
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none text-[16px] opacity-0"
      />
    </div>
  );
}
