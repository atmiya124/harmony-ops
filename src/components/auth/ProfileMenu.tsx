'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import type { Partner } from '@/lib/auth/session';
import { signOutToLogin } from './signOut';

// The top-right account button: a small dropdown with who's signed in and
// Sign out. (The Sales pages are reached from the menu button beside the
// title on Sales screens — see SalesMenuButton.)
export default function ProfileMenu({ partner }: { partner: Partner }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOutToLogin();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Profile menu"
        aria-expanded={open}
        data-profile-button
        className="flex size-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] backdrop-blur-md"
      >
        <Avatar partner={partner} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-[var(--flat-border-strong)] bg-[#0b131c] p-3 shadow-lg shadow-black/40">
          <p className="truncate text-[13px] font-bold text-white">{partner.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--flat-text-faint)]">{partner.email}</p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-[rgba(244,114,182,0.4)] py-2.5 text-xs font-bold text-[var(--neon-pink)] disabled:opacity-60"
          >
            <LogOut size={14} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Avatar({ partner }: { partner: Partner }) {
  const initial = (partner.name || partner.email).charAt(0).toUpperCase();
  if (partner.image) {
    // Google profile photos come from lh3.googleusercontent.com; a plain
    // <img> avoids configuring next/image remote patterns for one avatar.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={partner.image} alt="" referrerPolicy="no-referrer" className="size-11 rounded-full" />;
  }
  return <span className="flex size-11 items-center justify-center rounded-full text-lg font-bold text-white">{initial}</span>;
}
