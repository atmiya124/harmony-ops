'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Secondary switcher inside a section (e.g. All bookings · Today): a
// segmented control with a quiet raised segment for the active tab.
// Rendered only on the exact paths it lists, so detail pages (a single
// booking) don't get it.
//
// Light screens (Quotes & Invoices) use a white pill with a soft shadow and
// a light-grey active segment; `inline` sizes it to its labels for the
// header row instead of the full width below the title.
export default function SectionTabs({ tabs, label, tone = 'dark', inline = false }: { tabs: { label: string; href: string }[]; label: string; tone?: 'dark' | 'light'; inline?: boolean }) {
  const pathname = usePathname();
  if (!tabs.some((t) => t.href === pathname)) return null;
  const light = tone === 'light';
  return (
    <nav aria-label={label} className={inline ? 'relative' : 'relative mb-5'}>
      <div
        className={`${inline ? 'inline-grid' : 'grid'} rounded-full p-1 ${light ? 'bg-[var(--paper)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.05]' : 'border border-white/[0.08] bg-white/[0.04]'}`}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, ${inline ? 'auto' : 'minmax(0, 1fr)'})` }}
      >
        {tabs.map((t) => {
          const active = t.href === pathname;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full text-center transition ${inline ? 'px-4 py-1.5' : 'py-2'} ${
                light
                  ? active
                    ? 'bg-[var(--paper-sunk)] font-bold text-[var(--ink)]'
                    : 'font-medium text-[var(--ink-3)] hover:text-[var(--ink)]'
                  : active
                    ? 'font-semibold bg-white/[0.12] text-white shadow-sm shadow-black/40'
                    : 'font-semibold text-white/45 hover:text-white/70'
              }`}
            >
              <span className="text-[14px]">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
