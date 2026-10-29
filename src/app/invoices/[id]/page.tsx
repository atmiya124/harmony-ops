'use client';

import { use, useEffect, useState } from 'react';
import Screen from '@/components/navigation/Screen';
import InvoiceDetail from '@/components/sales/InvoiceDetail';
import { Avatar, LoadError, PdfActions } from '@/components/sales/ui';
import { peekCache } from '@/lib/clientCache';
import { getInvoice, invoiceKey, type InvoiceDto } from '@/lib/quotesApi';

// The header carries the invoice itself ("INV-000000012  Michael Smith")
// and its PDF actions, so the screen is drawn once the invoice is known.
export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Opened before: show the cached copy at once, then refresh.
  const [invoice, setInvoice] = useState<InvoiceDto | null>(() => peekCache<InvoiceDto>(invoiceKey(id)) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id)
      .then(setInvoice)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the invoice.'));
  }, [id]);

  return (
    <Screen
      title={invoice ? invoice.invoiceNumber : 'Invoice'}
      subtitle={invoice?.customerName}
      leading={invoice ? <Avatar name={invoice.customerName} size={36} /> : null}
      compactTitle
      back
      tone="light"
      action={
        invoice ? (
          // Phones only: on desktop the side panel's PDF buttons are in view.
          <span className="flex gap-1.5 lg:hidden">
            <PdfActions href={`/api/invoices/${invoice.id}/pdf`} compact />
          </span>
        ) : null
      }
    >
      {error && !invoice ? <LoadError message={error} /> : !invoice ? <div className="h-40 animate-pulse rounded-2xl bg-[var(--paper-sunk)]" aria-busy="true" /> : <InvoiceDetail invoice={invoice} onChange={setInvoice} />}
    </Screen>
  );
}
