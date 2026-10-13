import Screen from '@/components/navigation/Screen';
import QuoteBuilder from '@/components/sales/QuoteBuilder';
import { getQuoteDefaults } from '@/lib/db/quoteRepo';
import { QUOTE_DEFAULTS } from '@/lib/sales/defaults';
import { todayInFinanceTz } from '@/lib/finance/today';

// The defaults (tax rate from finance settings) and today's Toronto date are
// read on the server so a new quote starts from the business's settings.
// `?event=12` starts the quote from that booking.
export default async function NewQuotePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { event } = await searchParams;
  const eventId = typeof event === 'string' && /^\d+$/.test(event) ? Number(event) : null;
  const defaults = await getQuoteDefaults().catch((err) => {
    console.error('[quotes] loading defaults failed:', err);
    return QUOTE_DEFAULTS;
  });
  return (
    <Screen title="New quote" back tone="light">
      <QuoteBuilder mode="create" defaults={defaults} today={todayInFinanceTz()} initialEventId={eventId} />
    </Screen>
  );
}
