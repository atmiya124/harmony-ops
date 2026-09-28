'use client';

import { useRef } from 'react';
import { Calendar } from 'lucide-react';

// A compact date "chip" that opens the browser's native date picker when
// tapped or clicked anywhere on it. The native <input type="date"> stays in
// the DOM (invisible, positioned over the chip so the picker anchors here),
// but opening is done explicitly with showPicker(): desktop browsers only
// open the picker from the input's own calendar icon, not from a click on
// the rest of the field.
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
  const inputRef = useRef<HTMLInputElement>(null);

  function open() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // Older browsers without showPicker(): focusing/clicking the native
      // input is the best available fallback.
      input.focus();
      input.click();
    }
  }

  return (
    <div className="relative">
      {/* The whole chip (padding included) is the click target. */}
      <button type="button" onClick={open} aria-label={`${ariaLabel}: ${label}. Change date`} className={`flex w-full items-center gap-2.5 text-left ${className}`}>
        <Calendar size={16} className="shrink-0 text-white/45" />
        <span className="text-xs font-bold text-white">{label}</span>
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  );
}
