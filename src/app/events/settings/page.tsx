import { Settings } from 'lucide-react';
import Screen from '@/components/navigation/Screen';

function EventsSettingsPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-30 text-center">
      <Settings size={32} className="text-[var(--flat-text-ghost)]" />
      <p className="text-sm text-[var(--flat-text-ghost)]">Settings coming soon</p>
    </div>
  );
}

// Animated like a native screen push/pop (see components/navigation).
export default function Page() {
  return (
    <Screen title="Settings" back>
      <EventsSettingsPage />
    </Screen>
  );
}
