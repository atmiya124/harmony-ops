'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Boxes, ChevronRight, FileText, LogOut, ReceiptText, Users, X } from 'lucide-react';
import type { Partner } from '@/lib/auth/session';
import { SALES_PAGES, type SalesPageKey } from '../navTypes';

type Icon = (props: { size?: number; strokeWidth?: number; className?: string }) => React.ReactNode;

const ICONS: Record<SalesPageKey, Icon> = {
  quotes: FileText,
  invoices: ReceiptText,
  inventory: Boxes,
  customers: Users,
};

const SLIDE_MS = 220;

// The Sales menu: a light panel that slides in from the right when the
// profile button is tapped on a Sales screen. Who's signed in at the top,
// the Sales pages, and Log out pinned to the bottom.
export default function SalesMenu({
  partner,
  active,
  avatar,
  signingOut,
  onSignOut,
  onClose,
}: {
  partner: Partner;
  active: SalesPageKey | null;
  avatar: React.ReactNode;
  signingOut: boolean;
  onSignOut: () => void;
  onClose: () => void;
}) {
  // Mounted closed, then opened on the next frame so the slide-in animates;
  // closing slides out before the parent unmounts it.
  const [shown, setShown] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const close = () => {
    setShown(false);
    window.setTimeout(onClose, SLIDE_MS);
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    panel.current?.focus();
    // The page behind stays put while the menu is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShown(false);
        window.setTimeout(onClose, SLIDE_MS);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Portalled to <body>: the profile button's header is its own stacking
  // layer (below the tab bar), and the menu must cover everything.
  return createPortal(
    <div className="tone-light fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Sales menu">
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 bg-black/30 transition-opacity motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDuration: `${SLIDE_MS}ms` }}
      />
      <div
        ref={panel}
        tabIndex={-1}
        className={`absolute inset-y-0 right-0 flex w-[300px] max-w-[86vw] flex-col bg-[var(--bg)] shadow-[-12px_0_40px_rgba(0,0,0,0.18)] outline-none transition-transform ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${shown ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ transitionDuration: `${SLIDE_MS}ms` }}
      >
        {/* Who's signed in. */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ink)]">{avatar}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{partner.name}</span>
            <span className="block truncate text-[12px] text-[var(--ink-3)]">{partner.email}</span>
          </span>
          <button type="button" onClick={close} aria-label="Close menu" className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--ink-2)] transition hover:bg-[var(--paper-sunk)]">
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Sales" className="flex-1 overflow-y-auto px-3">
          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Sales</p>
          <ul className="space-y-1">
            {SALES_PAGES.map(({ key, label, href }) => {
              const Icon = ICONS[key];
              const current = key === active;
              return (
                <li key={key}>
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={current ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors ${current ? 'bg-[var(--paper)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'hover:bg-[var(--paper-sunk)]'}`}
                  >
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${current ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'bg-[var(--paper-sunk)] text-[var(--ink-2)]'}`}>
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <span className={`flex-1 text-[15px] ${current ? 'font-bold' : 'font-medium'}`}>{label}</span>
                    <ChevronRight size={16} className="text-[var(--ink-3)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Pinned to the bottom, clear of the phone's home indicator. */}
        <div className="border-t border-[var(--line)] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-[var(--bad)] transition-colors hover:bg-[var(--bad-soft)] disabled:opacity-60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bad-soft)]">
              <LogOut size={18} strokeWidth={2} />
            </span>
            <span className="text-[15px] font-semibold">{signingOut ? 'Logging out…' : 'Log out'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
