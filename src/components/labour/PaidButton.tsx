'use client';

import { Check } from 'lucide-react';

// The one-tap "Paid" pill on an owed crew row (see useQuickPay).
export default function PaidButton({ busy, disabled, onClick, label }: { busy: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-label={label}
      className="flex shrink-0 touch-manipulation select-none items-center gap-1 rounded-full border border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.08)] px-3 py-2 text-[var(--neon-green)] transition-transform duration-75 active:scale-[0.95] disabled:opacity-50"
    >
      <Check size={14} strokeWidth={3} />
      <span className="text-[13px] font-bold">{busy ? '…' : 'Paid'}</span>
    </button>
  );
}
