'use client';

import { useMemo, useState } from 'react';
import { Package, Plus, Search, Trash2 } from 'lucide-react';
import { useCachedData } from '@/hooks/useCachedData';
import { ApiError } from '@/lib/apiClient';
import { createInventoryItem, deleteInventoryItem, INVENTORY_KEY, listInventory, updateInventoryItem, type InventoryItemDto, type InventoryItemValues } from '@/lib/inventoryApi';
import { formatCents } from '@/lib/money';
import { parsePriceToCents, priceToInput } from '@/lib/sales/inputs';
import { SECTION_PRESETS } from '@/lib/sales/types';
import { buttonClass, Card, Field, inputClass, listCardClass, LoadError, Notice } from './ui';

// The price list the quote builder picks items from: add, edit and delete
// items, grouped under the quote section they belong to.
export default function InventoryList() {
  const [refresh, setRefresh] = useState(0);
  const { data: items, loading, error } = useCachedData(INVENTORY_KEY, listInventory, refresh);
  const [query, setQuery] = useState('');
  // The item being edited, 'new' for the add form, or null.
  const [editing, setEditing] = useState<InventoryItemDto | 'new' | null>(null);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<string, InventoryItemDto[]>();
    for (const item of items ?? []) {
      if (q && !`${item.itemName} ${item.description ?? ''} ${item.section}`.toLowerCase().includes(q)) continue;
      const list = groups.get(item.section) ?? [];
      list.push(item);
      groups.set(item.section, list);
    }
    return [...groups];
  }, [items, query]);

  const sectionNames = useMemo(() => [...new Set([...SECTION_PRESETS, ...(items ?? []).map((i) => i.section)])], [items]);

  const done = () => {
    setEditing(null);
    setRefresh((n) => n + 1);
  };

  if (error && !items) return <LoadError message={error} />;
  if (loading) {
    return (
      <div className={`${listCardClass} space-y-3 p-5`} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-[var(--paper-sunk)]" />
        ))}
      </div>
    );
  }

  const form = (item: InventoryItemDto | null) => <ItemForm key={item?.id ?? 'new'} item={item} sectionNames={sectionNames} onDone={done} onCancel={() => setEditing(null)} />;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
          <input aria-label="Search inventory" placeholder="Search items" className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="button" onClick={() => setEditing('new')} className={buttonClass('primary', 'shrink-0')} disabled={editing === 'new'}>
          <Plus size={16} /> Add item
        </button>
      </div>

      {editing === 'new' ? form(null) : null}

      {!items || items.length === 0 ? (
        editing === 'new' ? null : (
          <Card className="flex flex-col items-center gap-2 py-14 text-center">
            <Package size={28} className="text-[var(--ink-3)]" />
            <p className="text-[15px] font-semibold">No items yet</p>
            <p className="max-w-xs text-[13px] text-[var(--ink-3)]">Add the equipment and services you quote often. In the quote builder, start typing an item name to pick one and fill in its price.</p>
          </Card>
        )
      ) : sections.length === 0 ? (
        <p className="px-1 text-[14px] text-[var(--ink-3)]">No items match “{query.trim()}”.</p>
      ) : (
        sections.map(([section, list]) => (
          <Card key={section} padded={false} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--paper-sunk)] px-4 py-2.5">
              <span className="h-4 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
              <h2 className="min-w-0 flex-1 truncate text-[13px] font-bold uppercase tracking-[0.04em]">{section}</h2>
              <span className="text-[12px] text-[var(--ink-3)]">
                {list.length} {list.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <ul className="divide-y divide-[var(--line)]">
              {list.map((item) =>
                editing !== 'new' && editing?.id === item.id ? (
                  <li key={item.id} className="p-2">
                    {form(item)}
                  </li>
                ) : (
                  <li key={item.id}>
                    <button type="button" onClick={() => setEditing(item)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f0f0f2]">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold md:text-[14px]">{item.itemName}</span>
                        {item.description ? <span className="mt-0.5 block text-[13px] text-[var(--ink-3)]">{item.description}</span> : null}
                      </span>
                      <span className="shrink-0 text-[15px] font-semibold tabular-nums md:text-[14px]">{formatCents(item.unitPriceCents)}</span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

type FieldErrors = Partial<Record<'section' | 'itemName' | 'description' | 'unitPrice', string>>;

function ItemForm({ item, sectionNames, onDone, onCancel }: { item: InventoryItemDto | null; sectionNames: string[]; onDone: () => void; onCancel: () => void }) {
  // Generated once, so a retried save can't add the item twice.
  const [newId] = useState(() => crypto.randomUUID());
  const [section, setSection] = useState(item?.section ?? '');
  const [itemName, setItemName] = useState(item?.itemName ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [unitPrice, setUnitPrice] = useState(item ? priceToInput(item.unitPriceCents) : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    const next: FieldErrors = {};
    if (!section.trim()) next.section = 'Choose a section';
    if (!itemName.trim()) next.itemName = 'Enter an item name';
    const price = parsePriceToCents(unitPrice);
    if (!price.ok) next.unitPrice = unitPrice.trim() ? price.error : 'Enter a price';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0 || !price.ok) return;

    const values: InventoryItemValues = { section: section.trim(), itemName: itemName.trim(), description: description.trim() || null, unitPriceCents: price.value };
    setBusy(true);
    try {
      if (item) await updateInventoryItem(item.id, values, item.updatedAt);
      else await createInventoryItem(newId, values);
      onDone();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        setErrors({ section: fe.section?.[0], itemName: fe.itemName?.[0], description: fe.description?.[0], unitPrice: fe.unitPriceCents?.[0] });
        setFormError(err.message);
      } else {
        setFormError('Could not save the item. Please try again.');
      }
    }
  }

  async function remove() {
    if (!item) return;
    setBusy(true);
    try {
      await deleteInventoryItem(item.id);
      onDone();
    } catch (err) {
      setBusy(false);
      setFormError(err instanceof ApiError ? err.message : 'Could not delete the item. Please try again.');
    }
  }

  return (
    <Card className="ring-2 ring-[var(--accent-soft)]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-3"
      >
        {formError ? <Notice>{formError}</Notice> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Item name" error={errors.itemName}>
            <input className={`${inputClass} font-semibold`} value={itemName} onChange={(e) => setItemName(e.target.value)} aria-invalid={!!errors.itemName} autoFocus={!item} autoComplete="off" />
          </Field>
          <Field label="Section" error={errors.section} hint="The quote section it’s added under.">
            <input className={inputClass} list="inventory-sections" value={section} onChange={(e) => setSection(e.target.value)} aria-invalid={!!errors.section} autoComplete="off" />
            <datalist id="inventory-sections">
              {sectionNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Description (optional)" error={errors.description} className="md:col-span-1">
            <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Unit price" error={errors.unitPrice}>
            <span className="relative block">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">$</span>
              <input inputMode="decimal" placeholder="0.00" className={`${inputClass} pl-6`} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} aria-invalid={!!errors.unitPrice} />
            </span>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="submit" className={buttonClass('primary')} disabled={busy}>
            {busy ? 'Saving…' : item ? 'Save changes' : 'Add to inventory'}
          </button>
          <button type="button" onClick={onCancel} className={buttonClass('ghost')} disabled={busy}>
            Cancel
          </button>
          {item ? (
            confirmDelete ? (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[13px] text-[var(--ink-2)]">Delete this item?</span>
                <button type="button" onClick={remove} className={buttonClass('danger', 'px-4 py-2')} disabled={busy}>
                  Delete
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className={buttonClass('ghost', 'ml-auto text-[var(--bad)]')} disabled={busy}>
                <Trash2 size={15} /> Delete
              </button>
            )
          ) : null}
        </div>
        {item ? <p className="text-[12px] text-[var(--ink-3)]">Changes apply to new quote lines only — saved quotes keep the price they were given.</p> : null}
      </form>
    </Card>
  );
}
