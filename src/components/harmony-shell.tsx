'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Bookmark,
  Calculator,
  CalendarDays,
  Clock3,
  House,
  LayoutPanelLeft,
  MonitorSmartphone,
  Settings,
  Sparkles,
  SwitchCamera,
  Users,
} from 'lucide-react';

const navByMode = {
  calculator: [
    { href: '/calculator', label: 'Screen', icon: MonitorSmartphone },
    { href: '/calculator/stage', label: 'Stage', icon: LayoutPanelLeft },
    { href: '/calculator/reference', label: 'Reference', icon: BookOpen },
    { href: '/calculator/saved', label: 'Saved', icon: Bookmark },
    { href: '/calculator/settings', label: 'Settings', icon: Settings },
  ],
  events: [
    { href: '/events', label: 'Home', icon: House },
    { href: '/events/bookings', label: 'Bookings', icon: CalendarDays },
    { href: '/events/today', label: 'Today', icon: Clock3 },
    { href: '/events/settings', label: 'Settings', icon: Settings },
  ],
} as const;

export function HarmonyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = pathname.startsWith('/events') ? 'events' : 'calculator';
  const currentItems = navByMode[mode];
  const switchTarget = mode === 'calculator' ? '/events' : '/calculator';
  const switchIcon = mode === 'calculator' ? CalendarDays : Calculator;
  const SwitchIcon = switchIcon;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-[28px] border border-slate-700/90 bg-slate-900/85 p-3 shadow-2xl shadow-slate-950/30 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/40">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Harmony Ops</p>
              <h1 className="text-lg font-bold text-white">Production Control</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto rounded-full border border-slate-700 bg-slate-800/90 p-1.5">
            {currentItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href === '/events' && pathname.startsWith('/events'));
              return (
                <Link
                  key={label}
                  href={href}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-slate-50'
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              );
            })}

            <div className="mx-1 h-8 w-px shrink-0 bg-slate-600" />

            <Link
              href={switchTarget}
              className="flex shrink-0 items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              <SwitchIcon className="size-4" />
              <span className="hidden sm:inline">{mode === 'calculator' ? 'Events' : 'Calculator'}</span>
            </Link>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
