import Screen from '@/components/navigation/Screen';
import InventoryList from '@/components/sales/InventoryList';

export default function InventoryPage() {
  return (
    <Screen title="Inventory" section="sales" tone="light">
      <InventoryList />
    </Screen>
  );
}
