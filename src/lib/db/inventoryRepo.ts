// Inventory price list data access. Items are only ever copied into quotes,
// never referenced, so they can be edited or deleted freely.
import { asc, eq, sql } from 'drizzle-orm';
import { db } from './client';
import { inventoryItems, type InventoryItemRow } from './schema';
import { FinanceError, nextTimestamp, nowIso, type Actor, type Tx } from './financeRepo';
import type { InventoryCreateInput, InventoryUpdateInput } from '../schemas/inventory';

export interface InventoryItemDto {
  id: string;
  section: string;
  itemName: string;
  description: string | null;
  unitPriceCents: number;
  updatedAt: string;
}

function toDto(row: InventoryItemRow): InventoryItemDto {
  return { id: row.id, section: row.section, itemName: row.itemName, description: row.description, unitPriceCents: row.unitPriceCents, updatedAt: row.updatedAt };
}

// Grouped by section, then alphabetical.
export async function listInventory(): Promise<InventoryItemDto[]> {
  const rows = await db
    .select()
    .from(inventoryItems)
    .orderBy(asc(sql`lower(${inventoryItems.section})`), asc(sql`lower(${inventoryItems.itemName})`));
  return rows.map(toDto);
}

// One name per item, ignoring case and spacing, so the picker never shows
// two "Wireless Mic"s with different prices.
async function assertNameFree(tx: Tx, itemName: string, exceptId?: string) {
  const [clash] = await tx
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(sql`lower(trim(${inventoryItems.itemName})) = ${itemName.trim().toLowerCase()}`);
  if (clash && clash.id !== exceptId) {
    throw new FinanceError(409, 'An item with this name is already in the inventory.', { itemName: ['Already in the inventory'] });
  }
}

export async function createInventoryItem(input: InventoryCreateInput, actor: Actor): Promise<{ item: InventoryItemDto; created: boolean }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, input.id));
    if (existing) return { item: toDto(existing), created: false };
    await assertNameFree(tx, input.itemName);
    const now = nowIso();
    const [row] = await tx
      .insert(inventoryItems)
      .values({ ...input, createdAt: now, updatedAt: now, updatedByEmail: actor.email })
      .returning();
    return { item: toDto(row), created: true };
  });
}

export async function updateInventoryItem(id: string, input: InventoryUpdateInput, actor: Actor): Promise<InventoryItemDto> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    if (!before) throw new FinanceError(404, 'This item was deleted.');
    if (before.updatedAt !== input.expectedUpdatedAt) {
      throw new FinanceError(409, 'Someone else changed this item. Review their changes and try again.', undefined, toDto(before));
    }
    await assertNameFree(tx, input.itemName, id);
    const { section, itemName, description, unitPriceCents } = input;
    const [row] = await tx
      .update(inventoryItems)
      .set({ section, itemName, description, unitPriceCents, updatedAt: nextTimestamp(before.updatedAt), updatedByEmail: actor.email })
      .where(eq(inventoryItems.id, id))
      .returning();
    return toDto(row);
  });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
}
