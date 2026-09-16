'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, CalendarDays, Clock3, Home as HomeIcon, Monitor, Settings } from 'lucide-react';
import { CalcTab, EventsTab, Mode } from './navTypes';
import PlatformIcon from './icons/PlatformIcon';

type TabIcon = (props: { size?: number; className?: string }) => React.ReactNode;

const CALC_TABS: { key: CalcTab; label: string; href: string; icon: TabIcon }[] = [
  { key: 'led', label: 'Screen', href: '/calculator', icon: Monitor },
  { key: 'stage', label: 'Stage', href: '/calculator/stage', icon: PlatformIcon },
  { key: 'settings', label: 'Settings', href: '/calculator/settings', icon: Settings },
];

const EVENTS_TABS: { key: EventsTab; label: string; href: string; icon: TabIcon }[] = [
  { key: 'home', label: 'Home', href: '/events', icon: HomeIcon },
  { key: 'bookings', label: 'Bookings', href: '/events/bookings', icon: CalendarDays },
  { key: 'today', label: 'Today', href: '/events/today', icon: Clock3 },
  { key: 'settings', label: 'Settings', href: '/events/settings', icon: Settings },
];

function resolveMode(pathname: string): Mode {
  return pathname.startsWith('/events') ? 'events' : 'calculator';
}

function resolveCalcTab(pathname: string): CalcTab {
  if (pathname.startsWith('/calculator/stage')) return 'stage';
  if (pathname.startsWith('/calculator/settings')) return 'settings';
  return 'led';
}

function resolveEventsTab(pathname: string): EventsTab {
  if (pathname.startsWith('/events/bookings')) return 'bookings';
  if (pathname.startsWith('/events/today')) return 'today';
  if (pathname.startsWith('/events/settings')) return 'settings';
  return 'home';
}

export default function AppNav() {
  const pathname = usePathname();
  const mode = resolveMode(pathname);
  const tabs = mode === 'calculator' ? CALC_TABS : EVENTS_TABS;
  const activeTab = mode === 'calculator' ? resolveCalcTab(pathname) : resolveEventsTab(pathname);
  const switchTarget = mode === 'calculator' ? '/events' : '/calculator';
  const switchLabel = mode === 'calculator' ? 'Events' : 'Calc';
  const SwitchIcon = mode === 'calculator' ? CalendarDays : Calculator;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between px-5 pb-4">
      <div className="overflow-hidden rounded-full border border-white/[0.14] backdrop-blur-xl">
        <div className="flex items-center gap-1 bg-white/[0.04] p-1.5">
          {tabs.map(({ key, label, href, icon: Icon }) => {
            const isActive = key === activeTab;
            return (
              <Link
                key={key}
                href={href}
                aria-label={label}
                className={`flex w-20 flex-col items-center justify-center gap-0.5 rounded-full py-2 transition ${
                  isActive ? 'bg-white text-[#0a0a0a]' : 'text-white/55 hover:text-white/80'
                }`}
              >
                <Icon size={19} />
                <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-[#0a0a0a]' : 'text-white/50'}`}>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <Link
        href={switchTarget}
        className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-full border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.14)] shadow-lg shadow-black/35 backdrop-blur-xl"
      >
        <SwitchIcon size={19} className="text-[var(--neon-orange)]" />
        <span className="text-[10.5px] font-bold text-white/85">{switchLabel}</span>
      </Link>
    </div>
  );
}
