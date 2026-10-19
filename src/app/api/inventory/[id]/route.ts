import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { deleteInventoryItem, updateInventoryItem } from '@/lib/db/inventoryRepo';
import { inventoryUpdateSchema } from '@/lib/schemas/inventory';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

const idSchema = z.uuid();

async function itemId(params: Params['params']): Promise<string | null> {
  const { id } = await params;
  return idSchema.safeParse(id).success ? id : null;
}

const notFound = () => NextResponse.json({ error: 'Item not found' }, { status: 404 });

export const PATCH = withPartner<Request, Params>(async (req, { params, partner }) => {
  const id = await itemId(params);
  if (!id) return notFound();
  const body = parseBody(inventoryUpdateSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await updateInventoryItem(id, body.data, partner));
  } catch (err) {
    return financeErrorResponse(err, 'update inventory item');
  }
});

// Quotes keep their own copy of every picked item, so nothing else changes.
export const DELETE = withPartner<Request, Params>(async (_req, { params }) => {
  const id = await itemId(params);
  if (!id) return notFound();
  try {
    await deleteInventoryItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return financeErrorResponse(err, 'delete inventory item');
  }
});
