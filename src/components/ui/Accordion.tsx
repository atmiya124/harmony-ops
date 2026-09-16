'use client';

import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function Accordion({ title, subtitle, defaultOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center px-5 py-4.5 text-left"
      >
        <div className="mr-3 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--flat-text-faint)]">{title}</p>
          {subtitle && !open ? <p className="mt-1 truncate text-xs text-[var(--flat-text-fainter)]">{subtitle}</p> : null}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-[var(--flat-text-fainter)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="px-5 pb-5">{children}</div> : null}
    </div>
  );
}
