'use client';

import { useId, useState } from 'react';
import type { InventoryItemDto } from '@/lib/inventoryApi';
import { formatCents } from '@/lib/money';
import { matchInventory } from '@/lib/sales/inventoryMatch';
import { inputClass } from './ui';

// The quote builder's item name field: typing still works as before, and
// matching inventory items drop down below it. Picking one fills the line's
// name, description and price (all still editable on the quote).
export default function InventoryPicker({
  value,
  section,
  inventory,
  invalid,
  onType,
  onPick,
}: {
  value: string;
  section: string;
  inventory: InventoryItemDto[];
  invalid?: boolean;
  onType: (name: string) => void;
  onPick: (item: InventoryItemDto) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = open ? matchInventory(inventory, value, section) : [];
  const shown = matches.length > 0;
  const current = Math.min(active, matches.length - 1);

  const pick = (item: InventoryItemDto) => {
    onPick(item);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        aria-label="Item name"
        placeholder={inventory.length > 0 ? 'Item name — type to pick from inventory' : 'Item name, e.g. Indoor LED Wall P2.6'}
        className={`${inputClass} font-semibold`}
        value={value}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown ? `${listId}-${current}` : undefined}
        aria-invalid={invalid}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onType(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (!shown) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((current + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(matches[current]);
          }
        }}
      />
      {shown ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Inventory items"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--paper)] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {matches.map((item, i) => (
            <li
              key={item.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === current}
              // mousedown, not click: the input's blur would close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-start gap-3 px-3 py-2 ${i === current ? 'bg-[var(--paper-sunk)]' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{item.itemName}</span>
                <span className="block truncate text-[12px] text-[var(--ink-3)]">
                  {item.section}
                  {item.description ? ` · ${item.description}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums">{formatCents(item.unitPriceCents)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
