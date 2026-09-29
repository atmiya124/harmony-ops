'use client';

import { ViewTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import SectionTabs from '@/components/SectionTabs';
import { parentOf } from './navDirection';
import logoWhite from '@/logo-white.png';

// Wraps each page so route changes animate like native iOS navigation: the
// leaving screen exits as "screen-out" and the arriving one enters as
// "screen-in"; globals.css turns those into a push, pop or crossfade
// depending on <html data-nav>. It must live in each page (not a layout):
// layouts persist across navigations, so they never enter or exit.
// `default="none"` keeps unrelated transitions (refreshes, Suspense) still.
//
// Every screen also gets the same header row: optional back chevron +
// title on the left, level with the account avatar pinned top-right by the
// root layout.

const SECTION_TABS = {
  calculator: {
    label: 'Calculators',
    tabs: [
      { label: 'Screen', href: '/calculator' },
      { label: 'Stage', href: '/calculator/stage' },
      { label: 'Pricing', href: '/calculator/settings' },
    ],
  },
  bookings: {
    label: 'Bookings',
    tabs: [
      { label: 'All bookings', href: '/events/bookings' },
      { label: 'Today', href: '/events/today' },
    ],
  },
} as const;

const SLATE_BACKDROP: React.CSSProperties = {
  background: 'linear-gradient(180deg, #25324a 0%, rgba(30, 42, 62, 0.55) 38%, transparent 100%)',
};

// Dark at the top, glowing orange low and to the right, then faded into the
// page background. Three layers drift and
// breathe on their own slow loops (see .ember-* in globals.css). Each layer
// overhangs the box by 10% so its moving edges never show; positions below
// are in the layer's own (larger) coordinates.
// The fade is a plain gradient layer on top rather than a CSS mask: a mask
// over moving layers is re-rendered every frame on iPhone (Safari).
const EMBER_FADE = 'linear-gradient(180deg, transparent 58%, var(--bg) 92%)';
const EMBER_LAYERS: { className: string; background: string }[] = [
  // Faint warmth rising into the dark top.
  { className: 'ember-warmth', background: 'radial-gradient(ellipse 75% 20% at 75% 50%, rgba(150, 60, 20, 0.35), transparent 75%)' },
  // Ember band along the bottom of the glow.
  { className: 'ember-band', background: 'radial-gradient(ellipse 71% 9% at 54% 58%, rgba(232, 100, 28, 0.7), rgba(180, 64, 18, 0.3) 50%, transparent 80%)' },
  // Hot corner, low right.
  { className: 'ember-core', background: 'radial-gradient(ellipse 46% 13% at 92% 57%, rgba(255, 168, 64, 0.95), rgba(240, 110, 30, 0.55) 40%, transparent 78%)' },
];

function EmberBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
      {EMBER_LAYERS.map(({ className, background }) => (
        <div key={className} className={`absolute -inset-[10%] ${className}`} style={{ background }} />
      ))}
      <div className="absolute inset-0" style={{ background: EMBER_FADE }} />
    </div>
  );
}

export default function Screen({
  title,
  hideTitle = false,
  logo = false,
  back = false,
  action,
  backdrop = false,
  section,
  children,
}: {
  title: string;
  // Keep the title for screen readers only (e.g. a detail page whose hero
  // already shows the name).
  hideTitle?: boolean;
  // Show the Harmony logo above the title (Home).
  logo?: boolean;
  // Show a back chevron to this screen's parent (nested screens only).
  back?: boolean;
  // One round header action beside the avatar (e.g. "New booking").
  action?: React.ReactNode;
  // A gradient behind the top of the screen: soft slate-blue (true), or a
  // warm ember glow (Home).
  backdrop?: boolean | 'ember';
  section?: keyof typeof SECTION_TABS;
  children: React.ReactNode;
}) {
  const tabs = section ? SECTION_TABS[section] : null;
  // data-screen lets NavDirectionTracker find this screen when it animates
  // browser Back/Forward itself.
  const pathname = usePathname();
  return (
    <ViewTransition enter="screen-in" exit="screen-out" default="none">
      {/* An opaque, full-width, full-height surface (like a native screen)
          so the arriving screen covers the one underneath while they slide.
          The negative margins cancel <main>'s padding. */}
      <div data-screen={pathname} className="relative -mx-4 -mt-4 min-h-dvh bg-[var(--bg)] px-4 pt-4">
        {/* Same height as the avatar (44px) and on the same row; the right
            padding keeps long titles clear of it. */}
        {backdrop === 'ember' ? (
          <EmberBackdrop />
        ) : backdrop ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px]" style={SLATE_BACKDROP} />
        ) : null}
        {logo ? <Image src={logoWhite} alt="" loading="eager" className="relative mb-2 h-10 w-auto" /> : null}
        <header className="relative mb-4 flex h-11 items-center pr-14">
          {back ? (
            <Link href={parentOf(pathname)} aria-label="Back" className="-ml-2 mr-0.5 flex size-10 shrink-0 items-center justify-center text-white">
              <ChevronLeft size={28} />
            </Link>
          ) : null}
          <h1 className={hideTitle ? 'sr-only' : 'truncate text-[28px] font-bold leading-none tracking-tight text-white'}>{title}</h1>
          {action ? <div className="ml-auto flex shrink-0 items-center pl-3">{action}</div> : null}
        </header>
        {/* Section tabs travel with their screen, so they slide in with it. */}
        {tabs ? <SectionTabs tabs={[...tabs.tabs]} label={tabs.label} /> : null}
        {/* Positioned so it paints above the (absolute) backdrop gradient. */}
        {backdrop ? <div className="relative">{children}</div> : children}
      </div>
    </ViewTransition>
  );
}
