import { z } from 'zod';
import { MAX_AMOUNT_CENTS } from '../finance/types';

// Server-side validation for the inventory price list. The limits match a
// quote line (src/lib/schemas/quote.ts), so a picked item always fits one.

const requiredText = (max: number, message: string) => z.string(message).trim().min(1, message).max(max, `Keep it under ${max} characters`);

const inventoryFields = {
  section: requiredText(60, 'Choose a section'),
  itemName: requiredText(120, 'Enter an item name'),
  description: z
    .string()
    .trim()
    .max(500, 'Keep it under 500 characters')
    .nullish()
    .transform((v) => (v ? v : null)),
  unitPriceCents: z.number('Enter a price').int('Price must be in whole cents').min(0, "Price can't be negative").max(MAX_AMOUNT_CENTS, "Price can't exceed $1,000,000"),
};

export const inventoryCreateSchema = z.object({
  // Chosen by the browser, so a retried save can't add the item twice.
  id: z.uuid(),
  ...inventoryFields,
});
export type InventoryCreateInput = z.output<typeof inventoryCreateSchema>;

export const inventoryUpdateSchema = z.object({
  ...inventoryFields,
  expectedUpdatedAt: z.string().min(1),
});
export type InventoryUpdateInput = z.output<typeof inventoryUpdateSchema>;
