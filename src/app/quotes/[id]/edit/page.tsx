'use client';

import { use, useEffect, useState } from 'react';
import Screen from '@/components/navigation/Screen';
import QuoteBuilder from '@/components/sales/QuoteBuilder';
import { ButtonLink, Card, LoadError } from '@/components/sales/ui';
import { getQuote, type QuoteDto } from '@/lib/quotesApi';
import { isQuoteEditable, QUOTE_STATUS_LABELS } from '@/lib/sales/types';

function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Always the latest from the server: its updatedAt is the version the
  // save is checked against.
  const [quote, setQuote] = useState<QuoteDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQuote(id)
      .then(setQuote)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the quote.'));
  }, [id]);

  if (error) return <LoadError message={error} />;
  if (!quote) return <div className="h-40 animate-pulse rounded-xl bg-[var(--paper-sunk)]" aria-busy="true" />;
  if (!isQuoteEditable(quote.status)) {
    return (
      <Card className="py-10 text-center">
        <p className="text-[15px] font-semibold">{QUOTE_STATUS_LABELS[quote.status]} quotes can&rsquo;t be edited</p>
        <ButtonLink href={`/quotes/${id}`} variant="secondary" className="mt-4">
          Back to quote
        </ButtonLink>
      </Card>
    );
  }
  return <QuoteBuilder mode="edit" quote={quote} />;
}

export default function Page(props: React.ComponentProps<typeof EditQuotePage>) {
  return (
    <Screen title="Edit quote" back tone="light">
      <EditQuotePage {...props} />
    </Screen>
  );
}
