import { Settings } from 'lucide-react';

export default function CalculatorSettingsPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-30 text-center">
      <Settings size={32} className="text-[var(--flat-text-ghost)]" />
      <p className="text-sm text-[var(--flat-text-ghost)]">Settings coming soon</p>
    </div>
  );
}
