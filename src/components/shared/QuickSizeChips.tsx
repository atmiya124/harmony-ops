'use client';

interface QuickSizeChipsProps<T extends { label: string }> {
  items: T[];
  onSelect: (item: T) => void;
}

export default function QuickSizeChips<T extends { label: string }>({ items, onSelect }: QuickSizeChipsProps<T>) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onSelect(item)}
          className="rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] px-3 py-1.5 text-xs font-medium text-[var(--flat-text-dim)] transition hover:border-[var(--flat-border-strong)]"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
