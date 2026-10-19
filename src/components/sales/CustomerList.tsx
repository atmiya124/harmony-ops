'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Mail, Phone, Search, Users } from 'lucide-react';
import { useCachedData } from '@/hooks/useCachedData';
import { CUSTOMERS_KEY, listCustomers, type CustomerDto } from '@/lib/quotesApi';
import { formatCents } from '@/lib/money';
import { Avatar, Card, Chip, documentDate, inputClass, listCardClass, LoadError, QuoteStatusBadge } from './ui';

// Everyone a quote has been made for, A–Z. A row opens their contact
// details and quotes; each quote opens its details.
export default function CustomerList() {
  const { data: customers, loading, error } = useCachedData(CUSTOMERS_KEY, listCustomers);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (customers ?? []).filter((c) => {
      const haystack = [c.name, c.company, c.email, c.phone].filter(Boolean).join(' ').toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [customers, query]);

  if (error && !customers) return <LoadError message={error} />;
  if (loading) {
    return (
      <div className={`${listCardClass} space-y-3 p-5`} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-[var(--paper-sunk)]" />
        ))}
      </div>
    );
  }
  if (!customers || customers.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-14 text-center">
        <Users size={28} className="text-[var(--ink-3)]" />
        <p className="text-[15px] font-semibold">No customers yet</p>
        <p className="max-w-xs text-[13px] text-[var(--ink-3)]">Customers appear here once a quote has been made for them.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
        <input aria-label="Search customers" placeholder="Search name, company, email or phone" className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {shown.length === 0 ? (
        <p className="px-1 text-[14px] text-[var(--ink-3)]">No customers match “{query.trim()}”.</p>
      ) : (
        <ul className={listCardClass}>
          {shown.map((c) => (
            <CustomerRow key={c.key} customer={c} open={open === c.key} onToggle={() => setOpen(open === c.key ? null : c.key)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomerRow({ customer: c, open, onToggle }: { customer: CustomerDto; open: boolean; onToggle: () => void }) {
  const count = c.quotes.length;
  return (
    <li className="border-b border-[var(--line)] last:border-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f0f0f2] md:px-5">
        <Avatar name={c.name} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            {c.name}
            {c.company ? <span className="font-normal text-[var(--ink-2)]"> · {c.company}</span> : null}
          </span>
          <span className="block truncate text-[12px] text-[var(--ink-3)]">
            {count} {count === 1 ? 'quote' : 'quotes'} · last {documentDate(c.lastQuoteDate)}
            {c.clientType === 'contract' ? ' · Contract client' : ''}
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--ink-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="space-y-3 px-4 pb-4 md:px-5 md:pl-[66px]">
          {c.email || c.phone ? (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
              {c.email ? (
                <a href={`mailto:${c.email}`} className="flex min-w-0 items-center gap-1.5 text-[var(--accent-ink)] hover:underline">
                  <Mail size={14} className="shrink-0" /> <span className="break-all">{c.email}</span>
                </a>
              ) : null}
              {c.phone ? (
                <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-[var(--ink-2)] hover:underline">
                  <Phone size={14} /> {c.phone}
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--ink-3)]">No contact details</p>
          )}
          <ul className="overflow-hidden rounded-xl border border-[var(--line)]">
            {c.quotes.map((q) => (
              <li key={q.id} className="border-b border-[var(--line)] last:border-0">
                <Link href={`/quotes/${q.id}`} className="flex items-center gap-3 bg-[var(--paper-sunk)] px-3 py-2.5 transition-colors hover:bg-[#ecebe7]">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Chip>{q.quoteNumber}</Chip>
                      <QuoteStatusBadge status={q.status} />
                    </span>
                    <span className="mt-1 block truncate text-[12px] text-[var(--ink-3)]">{[q.eventName, documentDate(q.quoteDate)].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums">{formatCents(q.totalCents)}</span>
                  <ChevronRight size={15} className="shrink-0 text-[var(--ink-3)]" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
