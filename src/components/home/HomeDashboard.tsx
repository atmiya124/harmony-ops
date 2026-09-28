'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Calendar, CalendarDays, ChevronRight, Clock, Mail, MapPin, Monitor, MoreHorizontal, Phone, Plus, Receipt, Wallet, X } from 'lucide-react';
import PlatformIcon from '@/components/icons/PlatformIcon';
import StatusBadge from '@/components/booking/StatusBadge';
import ErrorState from '@/components/ui/ErrorState';
import { useBookings } from '@/hooks/useBookings';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import { buildReminderMailto, getPartnerSettings } from '@/lib/partnerApi';
import type { Booking } from '@/lib/bookingTypes';
import { todayLocal } from '@/lib/finance/dates';
import CardGlow from '@/components/ui/CardGlow';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function to12hr(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return time;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

const QUICK_LINKS: { href: string; title: string; subtitle: string; icon: (p: { size?: number; className?: string }) => React.ReactNode }[] = [
  { href: '/events/bookings', title: 'Bookings', subtitle: 'Manage events', icon: CalendarDays },
  { href: '/finances', title: 'Finances', subtitle: 'Track expenses', icon: Wallet },
  { href: '/calculator', title: 'LED Calculator', subtitle: 'Screen planning', icon: Monitor },
  { href: '/calculator/stage', title: 'Stage Calculator', subtitle: 'Stage planning', icon: PlatformIcon },
];

export default function HomeDashboard({ firstName }: { firstName: string }) {
  const { bookings, loading, error } = useBookings();
  const { openNewExpense } = useExpenseEntry();
  const [partnerEmails, setPartnerEmails] = useState<string[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const today = todayLocal();

  useEffect(() => {
    getPartnerSettings()
      .then((s) => setPartnerEmails(s.partnerEmails))
      .catch(() => {});
  }, []);

  const { upcoming, completedThisMonth, nextEvent } = useMemo(() => {
    const active = bookings.filter((b) => b.eventDate && b.eventDate >= today && (b.status === 'Confirmed' || b.status === 'Tentative'));
    active.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    const month = today.slice(0, 7);
    return {
      upcoming: active.length,
      completedThisMonth: bookings.filter((b) => b.status === 'Completed' && b.eventDate.startsWith(month)).length,
      nextEvent: active[0] as Booking | undefined,
    };
  }, [bookings, today]);

  return (
    <div className="space-y-5">
      {/* Hero — the "Harmony Ops" title is in the shared screen header. */}
      <section className="relative -mt-3">
        <div className="relative">
          <p className="text-[17px] text-white/75">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </p>
          <p className="mt-0.5 text-sm text-[var(--flat-text-faint)]">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <p className="relative mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--flat-text-faint)]">Upcoming events</p>
        <Link href="/events/bookings" className="relative mt-1 inline-flex items-center gap-2">
          <span className="text-[64px] font-bold leading-none tracking-tight text-white">{loading ? '–' : upcoming}</span>
          <ChevronRight size={26} className="text-white/50" />
        </Link>
        <p className="relative mt-1 text-sm text-[var(--flat-text-dim)]">
          {loading ? ' ' : `${completedThisMonth} event${completedThisMonth === 1 ? '' : 's'} completed this month`}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {QUICK_LINKS.map(({ href, title, subtitle, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-2.5 rounded-2xl border border-[var(--flat-border)] bg-[var(--flat-surface)] py-3.5 pl-3 pr-2 transition hover:border-[var(--flat-border-strong)]">
            <Icon size={22} className="shrink-0 text-white/85" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold leading-tight text-white">{title}</span>
              <span className="mt-0.5 block text-[11.5px] leading-tight text-[var(--flat-text-faint)]">{subtitle}</span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-white/35" />
          </Link>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Next event</h2>
          <Link href="/events/bookings" className="flex items-center gap-0.5 text-sm text-[var(--flat-text-dim)]">
            View all <ChevronRight size={16} />
          </Link>
        </div>
        {error ? (
          <ErrorState message={error} />
        ) : loading ? (
          <div className="h-44 animate-pulse rounded-3xl bg-white/[0.03]" />
        ) : nextEvent ? (
          <NextEventCard booking={nextEvent} partnerEmails={partnerEmails} />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] py-8 text-center">
            <Calendar size={24} className="text-[var(--flat-text-ghost)]" />
            <p className="text-sm text-[var(--flat-text-faint)]">No upcoming events</p>
            <Link href="/events/bookings/new" className="text-sm font-bold text-[var(--neon-cyan)]">
              Add a booking
            </Link>
          </div>
        )}
      </section>

      {/* Pinned just above the bottom navigation so an expense is always one
          tap away, however far the page is scrolled. The spacer keeps the
          last card from ending up underneath it. */}
      <div aria-hidden className="h-14" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[86px] z-40 flex justify-center px-4">
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="pointer-events-auto flex w-full max-w-[448px] items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[#0a0a0a] shadow-lg shadow-black/50"
        >
          <Plus size={20} />
          <span className="text-[16px] font-bold">Quick Add</span>
        </button>
      </div>

      {quickAddOpen ? (
        <QuickAddSheet
          onClose={() => setQuickAddOpen(false)}
          onExpense={() => {
            setQuickAddOpen(false);
            openNewExpense();
          }}
        />
      ) : null}
    </div>
  );
}

function NextEventCard({ booking, partnerEmails }: { booking: Booking; partnerEmails: string[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const time = [to12hr(booking.startTime), to12hr(booking.endTime)].filter(Boolean).join(' – ');
  const place = [booking.venueName, booking.venueAddress].filter(Boolean).join(', ');
  const actions = [
    { label: 'Call client', icon: Phone, href: booking.clientPhone ? `tel:${booking.clientPhone}` : undefined },
    { label: 'Open in Maps', icon: MapPin, href: booking.venueAddress ? `https://maps.google.com/?q=${encodeURIComponent(booking.venueAddress)}` : undefined },
    { label: 'Email client', icon: Mail, href: booking.clientEmail ? `mailto:${booking.clientEmail}` : undefined },
    { label: 'Remind partners', icon: Bell, href: partnerEmails.length > 0 ? buildReminderMailto(booking, partnerEmails) : undefined },
  ];

  return (
    <div className="relative rounded-3xl border border-white/[0.08] bg-[#0a0f16] px-4 pb-3 pt-3.5">
      <CardGlow radius="rounded-3xl" />
      <div className="relative">
      <div className="flex items-center justify-between">
        <StatusBadge status={booking.status} />
        <div ref={menuRef} className="relative">
          <button type="button" aria-label="Event actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className="flex size-8 items-center justify-center rounded-full text-white/60">
            <MoreHorizontal size={20} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#111821] py-1 shadow-lg shadow-black/40">
              {actions.map(({ label, icon: Icon, href }) =>
                href ? (
                  <a
                    key={label}
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel="noreferrer"
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-white/85 hover:bg-white/[0.05]"
                  >
                    <Icon size={15} />
                    <span className="text-sm">{label}</span>
                  </a>
                ) : (
                  <span key={label} className="flex items-center gap-2.5 px-3.5 py-2.5 text-white/25">
                    <Icon size={15} />
                    <span className="text-sm">{label}</span>
                  </span>
                ),
              )}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-[21px] font-bold leading-tight text-white">{booking.eventTitle || 'Untitled event'}</p>

      <div className="mt-2.5 space-y-1.5">
        <Row icon={Calendar} text={longDate(booking.eventDate)} />
        {time ? <Row icon={Clock} text={time} /> : null}
        {place ? <Row icon={MapPin} text={place} /> : null}
      </div>

      <Link href={`/events/bookings/${booking.id}`} className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-2.5">
        <span className="text-sm font-bold text-white">View event</span>
        <ChevronRight size={18} className="text-white/60" />
      </Link>
      </div>
    </div>
  );
}

function Row({ icon: Icon, text }: { icon: typeof Calendar; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-white/60" />
      <p className="text-sm text-white/85">{text}</p>
    </div>
  );
}

// A two-option chooser: most additions on the go are expenses, so that's first.
function QuickAddSheet({ onClose, onExpense }: { onClose: () => void; onExpense: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className={`absolute inset-0 bg-black/60 transition-opacity duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick add"
        className={`relative w-full max-w-[480px] rounded-t-[28px] border-t border-white/10 bg-[#0b1118] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/15" />
        <div className="mb-3 mt-3 flex items-center justify-between">
          <p className="text-lg font-bold text-white">Quick add</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2">
          <button type="button" onClick={onExpense} className="flex w-full items-center gap-3.5 rounded-2xl border border-[var(--flat-border)] bg-white/[0.03] p-4 text-left">
            <span className="flex size-11 items-center justify-center rounded-full bg-[rgba(167,139,250,0.16)]">
              <Receipt size={20} className="text-[var(--neon-purple)]" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold text-white">Expense</span>
              <span className="block text-xs text-[var(--flat-text-faint)]">Record something you paid for</span>
            </span>
            <ChevronRight size={18} className="text-white/35" />
          </button>
          <Link href="/events/bookings/new" onClick={onClose} className="flex w-full items-center gap-3.5 rounded-2xl border border-[var(--flat-border)] bg-white/[0.03] p-4">
            <span className="flex size-11 items-center justify-center rounded-full bg-[rgba(0,212,255,0.14)]">
              <CalendarDays size={20} className="text-[var(--neon-cyan)]" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold text-white">Booking</span>
              <span className="block text-xs text-[var(--flat-text-faint)]">Add a new event</span>
            </span>
            <ChevronRight size={18} className="text-white/35" />
          </Link>
        </div>
      </div>
    </div>
  );
}
