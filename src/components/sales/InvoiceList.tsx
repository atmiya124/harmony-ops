'use client';

import { Receipt } from 'lucide-react';
import { useCachedData } from '@/hooks/useCachedData';
import { INVOICES_KEY, listInvoices } from '@/lib/quotesApi';
import { formatCents } from '@/lib/money';
import { Avatar, Card, Chip, documentDate, InvoiceStatusBadge, listCardClass, listCellClass, listHeadClass, listRowClass, LoadError, PdfActions } from './ui';

// Invoices are read-only in Phase 1: they will be created from accepted
// quotes (copying the items and totals) in a later phase.
export default function InvoiceList() {
  const { data: invoices, loading, error } = useCachedData(INVOICES_KEY, listInvoices);

  if (error && !invoices) return <LoadError message={error} />;
  if (loading) {
    return (
      <div className={`${listCardClass} p-5`} aria-busy="true">
        <div className="h-9 animate-pulse rounded-lg bg-[var(--paper-sunk)]" />
      </div>
    );
  }
  if (!invoices || invoices.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-14 text-center">
        <Receipt size={28} className="text-[var(--ink-3)]" />
        <p className="text-[15px] font-semibold">No invoices yet</p>
        <p className="max-w-sm text-[13px] text-[var(--ink-3)]">Invoices will be created from accepted quotes, carrying over their items and totals.</p>
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
              <th className={listHeadClass}>Invoice №</th>
              <th className={listHeadClass}>Due</th>
              <th className={listHeadClass}>Status</th>
              <th className={`${listHeadClass} text-right`}>Total</th>
              <th className={`${listHeadClass} text-right`}>Balance</th>
              <th className={`${listHeadClass} text-right`}>
                <span className="sr-only">PDF</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className={listRowClass}>
                <td className={listCellClass}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={inv.customerName} />
                    <span className="truncate font-semibold">{inv.customerName}</span>
                  </span>
                </td>
                <td className={listCellClass}>
                  <Chip>{inv.invoiceNumber}</Chip>
                </td>
                <td className={`${listCellClass} whitespace-nowrap text-[var(--ink-2)]`}>{documentDate(inv.dueDate)}</td>
                <td className={listCellClass}>
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td className={`${listCellClass} whitespace-nowrap text-right tabular-nums text-[var(--ink-2)]`}>{formatCents(inv.totalCents)}</td>
                <td className={`${listCellClass} whitespace-nowrap text-right font-semibold tabular-nums`}>{formatCents(inv.balanceDueCents)}</td>
                <td className={listCellClass}>
                  <div className="flex justify-end gap-1.5">
                    <PdfActions href={`/api/invoices/${inv.id}/pdf`} compact />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: one compact row per invoice. */}
      <ul className={`${listCardClass} px-4 md:hidden`}>
        {invoices.map((inv) => (
          <li key={inv.id} className={`${listRowClass} flex items-center gap-3 py-3`}>
            <Avatar name={inv.customerName} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{inv.customerName}</span>
              <span className="block truncate text-[12px] text-[var(--ink-3)]">
                {inv.invoiceNumber} · Due {documentDate(inv.dueDate)}
              </span>
              <span className="mt-1 block">
                <InvoiceStatusBadge status={inv.status} />
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-[15px] font-semibold tabular-nums">{formatCents(inv.balanceDueCents)}</span>
              <span className="flex gap-1.5">
                <PdfActions href={`/api/invoices/${inv.id}/pdf`} compact />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
