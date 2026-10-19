import Screen from '@/components/navigation/Screen';
import CustomerList from '@/components/sales/CustomerList';

export default function CustomersPage() {
  return (
    <Screen title="Customers" tone="light">
      <CustomerList />
    </Screen>
  );
}
