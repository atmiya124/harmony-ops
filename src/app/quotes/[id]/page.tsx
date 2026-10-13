'use client';

import { use, useEffect, useState } from 'react';
import Screen from '@/components/navigation/Screen';
import QuoteDetail from '@/components/sales/QuoteDetail';
import { LoadError } from '@/components/sales/ui';
import { peekCache } from '@/lib/clientCache';
import { getQuote, quoteKey, type QuoteDto } from '@/lib/quotesApi';

function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Just saved or opened before: show the cached copy at once, then refresh.
  const [quote, setQuote] = useState<QuoteDto | null>(() => peekCache<QuoteDto>(quoteKey(id)) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQuote(id)
      .then(setQuote)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the quote.'));
  }, [id]);

  if (error && !quote) return <LoadError message={error} />;
  if (!quote) return <div className="h-40 animate-pulse rounded-xl bg-[var(--paper-sunk)]" aria-busy="true" />;
  return <QuoteDetail quote={quote} onChange={setQuote} />;
}

export default function Page(props: React.ComponentProps<typeof QuoteDetailPage>) {
  return (
    <Screen title="Quote" back tone="light">
      <QuoteDetailPage {...props} />
    </Screen>
  );
}
