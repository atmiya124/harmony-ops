import FinancesDashboard from '@/components/finances/FinancesDashboard';
import AddExpenseHeaderButton from '@/components/expenses/AddExpenseHeaderButton';
import Screen from '@/components/navigation/Screen';

export default function FinancesPage() {
  return (
    <Screen title="Finances" action={<AddExpenseHeaderButton />}>
      <FinancesDashboard />
    </Screen>
  );
}
