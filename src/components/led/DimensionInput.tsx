'use client';

interface DimensionInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit: string;
}

export default function DimensionInput({ label, value, onChangeText }: DimensionInputProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-[var(--flat-text-faint)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        inputMode="decimal"
        className="w-full rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-input)] px-4 py-3 text-lg font-semibold text-white outline-none transition focus:border-[var(--neon-cyan)]"
      />
    </label>
  );
}
