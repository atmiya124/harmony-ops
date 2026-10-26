'use client';

import { useEffect, useState } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { colorAlpha } from '@/lib/colorAlpha';

// The one-tap Paid toggle on a crew row (see useQuickPay): a small pill in
// the same soft-tint style as the pay status badges. Outlined with an empty
// circle while owed: a tap pays in full. Green with a filled check once
// paid: a tap asks "Undo?" for a few seconds and a second tap removes the
// payment, so a mis-tap is easy to reverse without an accidental un-pay.
export default function PaidButton({
  paid,
  busy,
  disabled,
  onPay,
  onUnpay,
  name,
}: {
  paid: boolean;
  busy: boolean;
  disabled?: boolean;
  onPay: () => void;
  onUnpay: () => void;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  // A compact pill with a larger invisible tap area around it.
  const base =
    "relative flex h-7 shrink-0 touch-manipulation select-none items-center gap-1.5 rounded-full border pl-1.5 pr-2.5 transition-[transform,background-color,border-color,color] duration-150 before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-[''] active:scale-[0.94] disabled:opacity-50";
  const tone = (color: string) => ({ backgroundColor: colorAlpha(color, 14), borderColor: colorAlpha(color, 30), color });

  if (!paid) {
    return (
      <button
        type="button"
        onClick={onPay}
        disabled={busy || disabled}
        aria-label={`Mark ${name} paid`}
        className={`${base} border-white/20 text-white/85 hover:border-white/40 hover:text-white`}
      >
        <span className={`size-4 rounded-full border-[1.5px] border-current opacity-60 ${busy ? 'animate-pulse' : ''}`} />
        <span className="text-[12px] font-semibold">Paid</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirming) return setConfirming(true);
        setConfirming(false);
        onUnpay();
      }}
      disabled={busy || disabled}
      aria-label={confirming ? `Confirm: mark ${name} unpaid` : `${name} is paid. Tap to mark unpaid`}
      className={base}
      style={tone(confirming ? 'var(--neon-orange)' : 'var(--neon-green)')}
    >
      <span className={`flex size-4 items-center justify-center rounded-full bg-current ${busy ? 'animate-pulse' : ''}`}>
        {confirming ? <Undo2 size={10} strokeWidth={3} className="text-[#0a0a0a]" /> : <Check size={10} strokeWidth={3.5} className="text-[#0a0a0a]" />}
      </span>
      <span className="text-[12px] font-semibold">{confirming ? 'Undo?' : 'Paid'}</span>
    </button>
  );
}
