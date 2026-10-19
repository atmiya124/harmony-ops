// Browser-side calls to the inventory price list API.
import type { InventoryItemDto } from './db/inventoryRepo';
import { invalidateCache } from './clientCache';
import { json, request } from './apiClient';

export type { InventoryItemDto };

export const INVENTORY_KEY = 'inventory:list';

export interface InventoryItemValues {
  section: string;
  itemName: string;
  description: string | null;
  unitPriceCents: number;
}

// Any change clears the cached list, so the quote builder picks up new prices.
function changed<T>(result: Promise<T>): Promise<T> {
  return result.then((value) => {
    invalidateCache(INVENTORY_KEY);
    return value;
  });
}

export const listInventory = () => request<InventoryItemDto[]>('/api/inventory');

export const createInventoryItem = (id: string, values: InventoryItemValues) => changed(request<InventoryItemDto>('/api/inventory', json('POST', { id, ...values })));

export const updateInventoryItem = (id: string, values: InventoryItemValues, expectedUpdatedAt: string) =>
  changed(request<InventoryItemDto>(`/api/inventory/${id}`, json('PATCH', { ...values, expectedUpdatedAt })));

export const deleteInventoryItem = (id: string) => changed(request<{ ok: true }>(`/api/inventory/${id}`, json('DELETE')));
