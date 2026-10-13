import { Plus } from 'lucide-react';
import Screen from '@/components/navigation/Screen';
import QuoteList from '@/components/sales/QuoteList';
import { ButtonLink } from '@/components/sales/ui';

export default function QuotesPage() {
  return (
    <Screen
      title="Quotes"
      section="sales"
      tone="light"
      action={
        <ButtonLink href="/quotes/new" aria-label="New quote" className="px-3.5 py-2">
          <Plus size={16} strokeWidth={2.5} />
          <span>New quote</span>
        </ButtonLink>
      }
    >
      <QuoteList />
    </Screen>
  );
}
