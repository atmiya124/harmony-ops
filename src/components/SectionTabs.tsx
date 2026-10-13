'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Secondary switcher inside a section (e.g. All bookings · Today): a
// full-width segmented control with a quiet raised segment for the active
// tab. Rendered only on the exact paths it lists, so detail pages (a single
// booking) don't get it.
export default function SectionTabs({ tabs, label, tone = 'dark' }: { tabs: { label: string; href: string }[]; label: string; tone?: 'dark' | 'light' }) {
  const pathname = usePathname();
  if (!tabs.some((t) => t.href === pathname)) return null;
  const light = tone === 'light';
  return (
    <nav aria-label={label} className={`relative mb-5 ${light ? 'md:max-w-xs' : ''}`}>
      <div
        className={`grid rounded-full border p-1 ${light ? 'border-[var(--line)] bg-[var(--paper)]' : 'border-white/[0.08] bg-white/[0.04]'}`}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => {
          const active = t.href === pathname;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full py-2 text-center transition ${
                light
                  ? active
                    ? 'bg-[var(--ink)] text-white'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                  : active
                    ? 'bg-white/[0.12] text-white shadow-sm shadow-black/40'
                    : 'text-white/45 hover:text-white/70'
              }`}
            >
              <span className="text-[14px] font-semibold">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
