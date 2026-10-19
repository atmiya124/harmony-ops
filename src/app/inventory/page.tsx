import Screen from '@/components/navigation/Screen';
import InventoryList from '@/components/sales/InventoryList';

export default function InventoryPage() {
  return (
    <Screen title="Inventory" tone="light">
      <InventoryList />
    </Screen>
  );
}
