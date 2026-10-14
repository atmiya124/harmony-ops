'use client';

import { usePathname } from 'next/navigation';

// Screens that use the light Quotes & Invoices theme and room for a table on
// desktop. Everything else keeps the phone-width dark frame.
export function isLightWideScreen(pathname: string): boolean {
  return /^\/(quotes|invoices|q)(\/|$)/.test(pathname);
}

// The app's outer frame. Client-side so it follows in-app navigation (the
// root layout itself doesn't re-render between screens).
export default function AppFrame({ children }: { children: React.ReactNode }) {
  const wide = isLightWideScreen(usePathname());
  return (
    // Sales screens use overflow: clip (not hidden) so position: sticky works
    // inside them, e.g. the quote builder's Totals panel.
    <div className={`relative mx-auto min-h-screen w-full bg-[var(--bg)] ${wide ? 'tone-light overflow-clip' : 'max-w-[480px] overflow-hidden'}`}>
      {children}
    </div>
  );
}
