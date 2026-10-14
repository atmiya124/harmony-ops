import Screen from '@/components/navigation/Screen';
import OwedToPartners from '@/components/finances/OwedToPartners';

// Opened from the Finances "Owed to partners" card.
export default function OwedPage() {
  return (
    <Screen title="Owed to partners" back>
      <OwedToPartners />
    </Screen>
  );
}
