'use client';

import { Receipt } from 'lucide-react';
import { useCachedData } from '@/hooks/useCachedData';
import { INVOICES_KEY, listInvoices } from '@/lib/quotesApi';
import { formatCents } from '@/lib/money';
import { Card, documentDate, InvoiceStatusBadge, LoadError, PdfActions } from './ui';

// Invoices are read-only in Phase 1: they will be created from accepted
// quotes (copying the items and totals) in a later phase.
export default function InvoiceList() {
  const { data: invoices, loading, error } = useCachedData(INVOICES_KEY, listInvoices);

  if (error && !invoices) return <LoadError message={error} />;
  if (loading) return <div className="h-16 animate-pulse rounded-xl bg-[var(--paper-sunk)]" aria-busy="true" />;
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
    <Card padded={false} className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-[14px]">
        <thead className="border-b border-[var(--line)] bg-[var(--paper-sunk)] text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)]">
          <tr>
            <th className="px-4 py-3">Invoice #</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Balance</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">
              <span className="sr-only">PDF</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-3 font-semibold tabular-nums">{inv.invoiceNumber}</td>
              <td className="px-4 py-3">{inv.customerName}</td>
              <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">{documentDate(inv.dueDate)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCents(inv.totalCents)}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCents(inv.balanceDueCents)}</td>
              <td className="px-4 py-3">
                <InvoiceStatusBadge status={inv.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  <PdfActions href={`/api/invoices/${inv.id}/pdf`} compact />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
