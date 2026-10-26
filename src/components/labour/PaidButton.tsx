'use client';

import { useEffect, useState } from 'react';
import { Check, Undo2 } from 'lucide-react';

// The one-tap Paid toggle on a crew row (see useQuickPay). White while
// owed: a tap pays in full. Green once paid: a tap asks "Mark unpaid?" for
// a few seconds and a second tap removes the payment, so a mis-tap is easy
// to reverse without an accidental un-pay.
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

  const base =
    'flex shrink-0 touch-manipulation select-none items-center gap-1 rounded-full px-3 py-2 transition-[transform,background-color,color] duration-100 active:scale-[0.95] disabled:opacity-50';

  if (!paid) {
    return (
      <button type="button" onClick={onPay} disabled={busy || disabled} aria-label={`Mark ${name} paid`} className={`${base} bg-white text-[#0a0a0a]`}>
        <Check size={14} strokeWidth={3} className="opacity-40" />
        <span className="text-[13px] font-bold">{busy ? '…' : 'Paid'}</span>
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
      className={`${base} ${confirming ? 'bg-[var(--neon-orange)] text-[#2a1200]' : 'bg-[var(--neon-green)] text-[#04210f]'}`}
    >
      {confirming ? <Undo2 size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
      <span className="text-[13px] font-bold">{busy ? '…' : confirming ? 'Mark unpaid?' : 'Paid'}</span>
    </button>
  );
}
