import Screen from '@/components/navigation/Screen';
import InvoiceList from '@/components/sales/InvoiceList';

export default function InvoicesPage() {
  return (
    <Screen title="Invoices" section="sales" tone="light">
      <InvoiceList />
    </Screen>
  );
}
