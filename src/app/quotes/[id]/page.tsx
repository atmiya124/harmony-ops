'use client';

import { use, useEffect, useState } from 'react';
import Screen from '@/components/navigation/Screen';
import QuoteDetail from '@/components/sales/QuoteDetail';
import { QuoteHeaderActions } from '@/components/sales/QuoteActions';
import { Avatar, LoadError } from '@/components/sales/ui';
import { peekCache } from '@/lib/clientCache';
import { getQuote, quoteKey, type QuoteDto } from '@/lib/quotesApi';

// The header carries the quote itself ("Q-000000218  Michael Smith") and
// its PDF actions, so the screen is drawn once the quote is known.
export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Just saved or opened before: show the cached copy at once, then refresh.
  const [quote, setQuote] = useState<QuoteDto | null>(() => peekCache<QuoteDto>(quoteKey(id)) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQuote(id)
      .then(setQuote)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the quote.'));
  }, [id]);

  return (
    <Screen
      title={quote ? quote.quoteNumber : 'Quote'}
      subtitle={quote?.customerName}
      leading={quote ? <Avatar name={quote.customerName} size={36} /> : null}
      compactTitle
      back
      tone="light"
      action={quote ? <QuoteHeaderActions quote={quote} onChange={setQuote} /> : null}
    >
      {error && !quote ? (
        <LoadError message={error} />
      ) : !quote ? (
        <div className="h-40 animate-pulse rounded-2xl bg-[var(--paper-sunk)]" aria-busy="true" />
      ) : (
        <QuoteDetail quote={quote} onChange={setQuote} />
      )}
    </Screen>
  );
}
