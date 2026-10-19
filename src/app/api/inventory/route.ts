import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { createInventoryItem, listInventory } from '@/lib/db/inventoryRepo';
import { inventoryCreateSchema } from '@/lib/schemas/inventory';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

// The whole price list (it's small), grouped by section.
export const GET = withPartner(async () => {
  try {
    return NextResponse.json(await listInventory());
  } catch (err) {
    return financeErrorResponse(err, 'list inventory');
  }
});

export const POST = withPartner(async (req, { partner }) => {
  const body = parseBody(inventoryCreateSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    const { item, created } = await createInventoryItem(body.data, partner);
    return NextResponse.json(item, { status: created ? 201 : 200 });
  } catch (err) {
    return financeErrorResponse(err, 'create inventory item');
  }
});
