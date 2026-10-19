import { Plus } from 'lucide-react';
import Screen from '@/components/navigation/Screen';
import QuoteList from '@/components/sales/QuoteList';
import UnsavedQuoteNotice from '@/components/sales/UnsavedQuoteNotice';
import { FloatingActionLink, IconLink } from '@/components/sales/ui';

// New quote: a header icon on desktop, a floating button on phones.
export default function QuotesPage() {
  return (
    <Screen
      title="Quotes"
      section="sales"
      tone="light"
      action={
        <span className="hidden md:contents">
          <IconLink href="/quotes/new" label="New quote">
            <Plus size={18} strokeWidth={2.25} />
          </IconLink>
        </span>
      }
    >
      <UnsavedQuoteNotice />
      <QuoteList />
      <FloatingActionLink href="/quotes/new" label="New quote">
        <Plus size={26} strokeWidth={2.5} />
      </FloatingActionLink>
    </Screen>
  );
}
