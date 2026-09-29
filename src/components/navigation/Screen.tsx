'use client';

import { ViewTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import SectionTabs from '@/components/SectionTabs';
import { parentOf } from './navDirection';

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
// page background. Two glow layers drift and breathe on their own slow loops,
// and between them an ember wave rolls sideways and swells (see .ember-* in
// globals.css). Each glow layer overhangs the box by 10% so its moving edges
// never show; positions below are in the layer's own (larger) coordinates.
// The fades are plain gradient layers on top rather than CSS masks: a mask
// over moving layers is re-rendered every frame on iPhone (Safari).
const EMBER_FADE = 'linear-gradient(180deg, transparent 51%, var(--bg) 85%)';
// Dims the wave toward the left so the light still gathers on the right.
const EMBER_SIDE_FADE = 'linear-gradient(90deg, color-mix(in srgb, var(--bg) 70%, transparent), transparent 55%)';
const EMBER_WARMTH = { className: 'ember-warmth', background: 'radial-gradient(ellipse 75% 20% at 75% 44%, rgba(150, 60, 20, 0.35), transparent 75%)' };
const EMBER_CORE = { className: 'ember-core', background: 'radial-gradient(ellipse 46% 13% at 92% 51%, rgba(255, 168, 64, 0.95), rgba(240, 110, 30, 0.55) 40%, transparent 78%)' };

// Two periods of a sine-like curve across the 1200-wide viewBox, extended a
// period past each side so the blur never thins out at the edges. The layer is
// twice the screen width and slides left by half, so the loop is seamless.
const WAVE_PATH = 'M-600 60 C-500 38 -400 38 -300 60 S-100 82 0 60 S200 38 300 60 S500 82 600 60 S800 38 900 60 S1100 82 1200 60 S1400 38 1500 60 S1700 82 1800 60';

function EmberWave() {
  return (
    // Centred where the old ember band sat (~220px down).
    <div className="ember-wave-swell absolute inset-x-0 top-[160px] h-[120px]">
      <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="ember-wave-roll absolute inset-y-0 left-0 h-full w-[200%]">
        <defs>
          <filter id="ember-wave-soft" filterUnits="userSpaceOnUse" x="-100" y="-60" width="1400" height="240">
            <feGaussianBlur stdDeviation="16 14" />
          </filter>
          <filter id="ember-wave-hot" filterUnits="userSpaceOnUse" x="-100" y="-60" width="1400" height="240">
            <feGaussianBlur stdDeviation="7 5" />
          </filter>
        </defs>
        <path d={WAVE_PATH} fill="none" stroke="rgb(232, 100, 28)" strokeOpacity="0.45" strokeWidth="34" filter="url(#ember-wave-soft)" />
        <path d={WAVE_PATH} fill="none" stroke="rgb(255, 150, 60)" strokeOpacity="0.36" strokeWidth="7" filter="url(#ember-wave-hot)" />
      </svg>
    </div>
  );
}

// Clipped to the letters; the vertical padding (cancelled by the margin) keeps
// the descenders of y and p inside the painted background.
const TITLE_GLOW =
  '-my-[0.12em] bg-[linear-gradient(100deg,#ffffff_0%,#fff3e8_38%,#ffc28c_72%,#ff8a3d_100%)] bg-clip-text py-[0.12em] text-transparent';

function EmberBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
      <div className={`absolute -inset-[10%] ${EMBER_WARMTH.className}`} style={{ background: EMBER_WARMTH.background }} />
      <EmberWave />
      <div className="absolute inset-0" style={{ background: EMBER_SIDE_FADE }} />
      <div className={`absolute -inset-[10%] ${EMBER_CORE.className}`} style={{ background: EMBER_CORE.background }} />
      <div className="absolute inset-0" style={{ background: EMBER_FADE }} />
    </div>
  );
}

export default function Screen({
  title,
  hideTitle = false,
  glowTitle = false,
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
  // Warm white-to-ember gradient title, for screens with the ember glow.
  glowTitle?: boolean;
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
        <header className="relative mb-4 flex h-11 items-center pr-14">
          {back ? (
            <Link href={parentOf(pathname)} aria-label="Back" className="-ml-2 mr-0.5 flex size-10 shrink-0 items-center justify-center text-white">
              <ChevronLeft size={28} />
            </Link>
          ) : null}
          <h1
            className={
              hideTitle
                ? 'sr-only'
                : `truncate text-[28px] font-bold leading-none tracking-tight ${glowTitle ? TITLE_GLOW : 'text-white'}`
            }
          >
            {title}
          </h1>
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
