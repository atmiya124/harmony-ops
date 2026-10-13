'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, FileText, Plus } from 'lucide-react';
import { useCachedData } from '@/hooks/useCachedData';
import { listQuotes, QUOTES_KEY, type QuoteSummaryDto } from '@/lib/quotesApi';
import { formatCents } from '@/lib/money';
import { ButtonLink, Card, documentDate, LoadError, QuoteStatusBadge } from './ui';

// All quotes, newest first. A row opens the read-only details — editing is
// always one deliberate step further.
export default function QuoteList() {
  const { data: quotes, loading, error } = useCachedData(QUOTES_KEY, listQuotes);
  const router = useRouter();

  if (error && !quotes) return <LoadError message={error} />;
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--paper-sunk)]" />
        ))}
      </div>
    );
  }
  if (!quotes || quotes.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-14 text-center">
        <FileText size={28} className="text-[var(--ink-3)]" />
        <p className="text-[15px] font-semibold">No quotes yet</p>
        <p className="max-w-xs text-[13px] text-[var(--ink-3)]">Build a quote from scratch or from one of your bookings.</p>
        <ButtonLink href="/quotes/new" className="mt-3">
          <Plus size={16} /> New quote
        </ButtonLink>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop: a plain, scannable table. */}
      <Card padded={false} className="hidden overflow-hidden md:block">
        <table className="w-full text-left text-[14px]">
          <thead className="border-b border-[var(--line)] bg-[var(--paper-sunk)] text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)]">
            <tr>
              <th className="px-4 py-3 font-bold">Quote #</th>
              <th className="px-4 py-3 font-bold">Customer</th>
              <th className="px-4 py-3 font-bold">Event</th>
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 text-right font-bold">Total</th>
              <th className="px-4 py-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {quotes.map((q) => (
              <tr
                key={q.id}
                onClick={() => router.push(`/quotes/${q.id}`)}
                className="cursor-pointer transition hover:bg-[var(--paper-sunk)]"
              >
                <td className="px-4 py-3">
                  {/* The real link, for keyboard users and middle-click. */}
                  <Link href={`/quotes/${q.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold tabular-nums text-[var(--ink)] hover:underline">
                    {q.quoteNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="block font-medium">{q.customerName}</span>
                  {q.customerCompany ? <span className="block text-[12px] text-[var(--ink-3)]">{q.customerCompany}</span> : null}
                </td>
                <td className="px-4 py-3 text-[var(--ink-2)]">
                  <span className="block">{q.eventName || '—'}</span>
                  {q.eventDate ? <span className="block text-[12px] text-[var(--ink-3)]">{documentDate(q.eventDate)}</span> : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">{documentDate(q.quoteDate)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{formatCents(q.totalCents)}</td>
                <td className="px-4 py-3">
                  <QuoteStatusBadge status={q.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Phone: compact cards. */}
      <ul className="space-y-2 md:hidden">
        {quotes.map((q) => (
          <QuoteCard key={q.id} quote={q} />
        ))}
      </ul>
    </>
  );
}

function QuoteCard({ quote: q }: { quote: QuoteSummaryDto }) {
  return (
    <li>
      <Link href={`/quotes/${q.id}`} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 active:bg-[var(--paper-sunk)]">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tabular-nums text-[var(--ink-3)]">{q.quoteNumber}</span>
            <QuoteStatusBadge status={q.status} />
          </span>
          <span className="mt-1 block truncate text-[16px] font-semibold">{q.customerName}</span>
          <span className="block truncate text-[13px] text-[var(--ink-3)]">{[q.eventName, documentDate(q.quoteDate)].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-semibold tabular-nums">{formatCents(q.totalCents)}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-[var(--ink-3)]" />
      </Link>
    </li>
  );
}
