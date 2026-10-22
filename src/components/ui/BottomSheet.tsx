'use client';

import { useEffect, useId, useState } from 'react';
import { Loader2, X } from 'lucide-react';

// The slide-up sheet used for quick entry (crew labour, crew payments, crew
// profiles): same look and motion as the Add Expense sheet. The body
// scrolls; the footer holds the primary action. Tapping outside or Escape
// closes it unless there are unsaved changes.
export default function BottomSheet({
  title,
  subtitle,
  dirty = false,
  busy = false,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  dirty?: boolean;
  busy?: boolean;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previous;
    };
  }, []);

  function close() {
    if (busy) return;
    setOpen(false);
    window.setTimeout(onClose, 250); // after the slide-down finishes
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !dirty) close();
      }}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => !dirty && close()}
        className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[94dvh] w-full max-w-[480px] flex-col rounded-t-[28px] border-t border-white/10 bg-[#0b1118] shadow-2xl shadow-black transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/15" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-1 pt-3">
          <div className="min-w-0">
            <p id={titleId} className="truncate text-lg font-bold text-white">
              {title}
            </p>
            {subtitle ? <p className="truncate text-xs text-[var(--flat-text-faint)]">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={close} aria-label="Close" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-2">{children}</div>
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0b1118] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>
      </div>
    </div>
  );
}

// The white full-width primary button at the bottom of a sheet.
export function SheetButton({ busy, disabled, onClick, children }: { busy?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-[15px] font-bold text-[#0a0a0a] transition disabled:opacity-35"
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : null}
      <span className="text-[15px] font-bold">{children}</span>
    </button>
  );
}

export function SheetSection({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">{label}</p>
      {children}
      {error ? <p className="mt-1.5 text-xs text-[var(--neon-pink)]">{error}</p> : null}
    </div>
  );
}

export function SheetError({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="rounded-2xl border border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.08)] px-3.5 py-2.5 text-xs text-[var(--neon-pink)]">{message}</div>;
}
