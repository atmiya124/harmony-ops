'use client';

import { ArrowRight, Delete } from 'lucide-react';
import type { KeypadKey } from '@/lib/amountKeypad';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

// The amount keypad pinned to the bottom of the expense sheet (in the style
// of Wealthsimple's order screen): a status pill and a round "next" arrow
// above a 3x4 number pad. Being part of the page, it never opens the phone
// keyboard, so the sheet doesn't jump when you start typing.
export default function AmountKeypad({
  hint,
  canContinue,
  onKey,
  onContinue,
}: {
  // What's needed next, e.g. "Enter the amount" or "Next: choose a category".
  hint: string;
  canContinue: boolean;
  onKey: (key: KeypadKey) => void;
  onContinue: () => void;
}) {
  return (
    <div className="shrink-0">
      <div className="flex items-center gap-3 px-5 pb-3 pt-2">
        <p role="status" className="flex h-14 min-w-0 flex-1 items-center rounded-full border border-white/[0.1] bg-white/[0.04] px-5">
          <span className="truncate text-[15px] font-bold text-white/85">{hint}</span>
        </p>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          aria-label="Done with amount"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-[#0a0a0a] transition disabled:bg-white/25 disabled:text-white/60"
        >
          <ArrowRight size={24} />
        </button>
      </div>
      <div className="rounded-t-[26px] bg-white/[0.06] px-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5" aria-label="Amount keypad" role="group">
        <div className="grid grid-cols-3 gap-1.5">
          {ROWS.flat().map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onKey(key)}
              aria-label={key === 'backspace' ? 'Delete last digit' : key === '.' ? 'Decimal point' : key}
              className={`flex h-[52px] touch-manipulation select-none items-center justify-center rounded-[10px] text-white transition-colors duration-75 active:bg-white/30 ${
                key === 'backspace' ? 'bg-transparent active:bg-white/15' : 'bg-white/[0.13]'
              }`}
            >
              {key === 'backspace' ? <Delete size={24} strokeWidth={1.75} /> : <span style={{ fontSize: 26, fontWeight: 400, lineHeight: 1 }}>{key}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
