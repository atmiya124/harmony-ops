import { Plus } from 'lucide-react';
import Screen from '@/components/navigation/Screen';
import QuoteList from '@/components/sales/QuoteList';
import { IconLink } from '@/components/sales/ui';

export default function QuotesPage() {
  return (
    <Screen
      title="Quotes"
      section="sales"
      tone="light"
      action={
        <IconLink href="/quotes/new" label="New quote">
          <Plus size={18} strokeWidth={2.25} />
        </IconLink>
      }
    >
      <QuoteList />
    </Screen>
  );
}
