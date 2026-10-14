'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, FileText, Plus } from 'lucide-react';
import { useCachedData } from '@/hooks/useCachedData';
import { listQuotes, QUOTES_KEY, type QuoteSummaryDto } from '@/lib/quotesApi';
import { formatCents } from '@/lib/money';
import { Avatar, ButtonLink, Card, Chip, documentDate, listCardClass, listCellClass, listHeadClass, listRowClass, listRowHoverClass, LoadError, QuoteStatusBadge } from './ui';

// All quotes, newest first. A row opens the read-only details — editing is
// always one deliberate step further.
export default function QuoteList() {
  const { data: quotes, loading, error } = useCachedData(QUOTES_KEY, listQuotes);
  const router = useRouter();

  if (error && !quotes) return <LoadError message={error} />;
  if (loading) {
    return (
      <div className={`${listCardClass} space-y-3 p-5`} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-[var(--paper-sunk)]" />
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
      <div className={`${listCardClass} hidden md:block`}>
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className={listHeadClass}>Customer</th>
              <th className={listHeadClass}>Quote №</th>
              <th className={listHeadClass}>Event</th>
              <th className={listHeadClass}>Quote date</th>
              <th className={listHeadClass}>Status</th>
              <th className={`${listHeadClass} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} onClick={() => router.push(`/quotes/${q.id}`)} className={`${listRowClass} ${listRowHoverClass}`}>
                <td className={listCellClass}>
                  {/* The real link, for keyboard users and middle-click. */}
                  <Link href={`/quotes/${q.id}`} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2.5 hover:underline">
                    <Avatar name={q.customerName} />
                    <span className="truncate font-semibold text-[var(--ink)]">{q.customerName}</span>
                    {q.customerCompany ? <span className="truncate text-[var(--ink-2)]">{q.customerCompany}</span> : null}
                  </Link>
                </td>
                <td className={listCellClass}>
                  <Chip>{q.quoteNumber}</Chip>
                </td>
                <td className={`${listCellClass} max-w-[220px] text-[var(--ink-2)]`}>
                  <span className="block truncate">{q.eventName || '—'}</span>
                  {q.eventDate ? <span className="block text-[12px] text-[var(--ink-3)]">{documentDate(q.eventDate)}</span> : null}
                </td>
                <td className={`${listCellClass} whitespace-nowrap text-[var(--ink-2)]`}>{documentDate(q.quoteDate)}</td>
                <td className={listCellClass}>
                  <QuoteStatusBadge status={q.status} />
                </td>
                <td className={`${listCellClass} whitespace-nowrap text-right font-semibold tabular-nums`}>{formatCents(q.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: the same card, one compact row per quote. */}
      <ul className={`${listCardClass} px-4 md:hidden`}>
        {quotes.map((q) => (
          <QuoteRow key={q.id} quote={q} />
        ))}
      </ul>
    </>
  );
}

function QuoteRow({ quote: q }: { quote: QuoteSummaryDto }) {
  return (
    <li className={listRowClass}>
      <Link href={`/quotes/${q.id}`} className="flex items-center gap-3 py-3 active:opacity-70">
        <Avatar name={q.customerName} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{q.customerName}</span>
          <span className="block truncate text-[12px] text-[var(--ink-3)]">{[q.quoteNumber, q.eventName, documentDate(q.quoteDate)].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[15px] font-semibold tabular-nums">{formatCents(q.totalCents)}</span>
          <QuoteStatusBadge status={q.status} />
        </span>
        <ChevronRight size={16} className="shrink-0 text-[var(--ink-3)]" />
      </Link>
    </li>
  );
}
