'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Home as HomeIcon, Wallet } from 'lucide-react';
import { NavTab } from './navTypes';

type TabIcon = (props: { size?: number; className?: string }) => React.ReactNode;

const TABS: { key: NavTab; label: string; href: string; icon: TabIcon }[] = [
  { key: 'home', label: 'Home', href: '/', icon: HomeIcon },
  { key: 'bookings', label: 'Bookings', href: '/events/bookings', icon: CalendarDays },
  { key: 'finances', label: 'Finances', href: '/finances', icon: Wallet },
];

// Tab geometry: each tab is w-24 (96px) with a 4px gap, so the sliding fill
// moves in 100px steps.
const TAB_STEP_PX = 100;

// The calculators are opened from Home, so they keep Home highlighted.
function resolveTab(pathname: string): NavTab {
  if (pathname.startsWith('/events')) return 'bookings';
  if (pathname.startsWith('/finances')) return 'finances';
  return 'home';
}

// Apple-style tab bar: frosted glass that blurs whatever scrolls behind it,
// and a single white fill that slides to the tapped tab.
export default function AppNav() {
  const pathname = usePathname();
  // The fill moves the moment a tab is tapped, not when the new screen has
  // finished loading. The tap remembers the page it came from, so once the
  // route changes the real pathname takes over again.
  const [pending, setPending] = useState<{ tab: NavTab; from: string } | null>(null);
  const activeTab = pending && pending.from === pathname ? pending.tab : resolveTab(pathname);
  const activeIndex = TABS.findIndex((t) => t.key === activeTab);

  return (
    // The transition name sits on the glass pill itself, not on this wrapper:
    // a named ancestor becomes the blur's backdrop root and hides the page.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-5 pb-4">
      <nav
        aria-label="Main"
        style={{ viewTransitionName: 'app-nav' }}
        className="pointer-events-auto relative overflow-hidden rounded-full border border-white/[0.12] bg-[rgba(24,29,37,0.55)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-[1.8]"
      >
        <div className="relative flex items-center gap-1 p-1.5">
          {/* The sliding fill: one element, moved with a transform (GPU),
              on Apple's springy ease-out. */}
          <span
            aria-hidden
            className="absolute bottom-1.5 left-1.5 top-1.5 w-24 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none"
            style={{ transform: `translateX(${activeIndex * TAB_STEP_PX}px)` }}
          />
          {TABS.map(({ key, label, href, icon: Icon }) => {
            const isActive = key === activeTab;
            return (
              <Link
                key={key}
                href={href}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                data-nav="fade"
                onClick={() => setPending({ tab: key, from: pathname })}
                className={`relative flex w-24 flex-col items-center justify-center gap-0.5 rounded-full py-2 transition-colors duration-300 ${
                  isActive ? 'text-[#0a0a0a]' : 'text-white/60 hover:text-white/85'
                }`}
              >
                <Icon size={19} />
                <span className="text-[10px] font-semibold leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
