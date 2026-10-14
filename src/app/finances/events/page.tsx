import Screen from '@/components/navigation/Screen';
import EventExpenses from '@/components/finances/EventExpenses';

// Opened from the Finances "Event expenses" card; `?range=` is the period
// the card was showing.
export default async function EventExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { range } = await searchParams;
  return (
    <Screen title="Event expenses" back>
      <EventExpenses initialRange={typeof range === 'string' ? range : null} />
    </Screen>
  );
}
