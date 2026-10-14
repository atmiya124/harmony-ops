import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { createClientLink, getStaffClientLink, revokeClientLink } from '@/lib/db/clientLinkRepo';
import { financeErrorResponse } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

async function quoteId(params: Params['params']): Promise<string | null> {
  const { id } = await params;
  return z.uuid().safeParse(id).success ? id : null;
}

const notFound = () => NextResponse.json({ error: 'Quote not found' }, { status: 404 });

// Staff: the quote's live client link (to copy/open) and the client's responses.
export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const id = await quoteId(params);
  if (!id) return notFound();
  try {
    return NextResponse.json(await getStaffClientLink(id));
  } catch (err) {
    return financeErrorResponse(err, 'load client link');
  }
});

// Staff: create a link — or regenerate one, which revokes the old link.
export const POST = withPartner<Request, Params>(async (_req, { params, partner }) => {
  const id = await quoteId(params);
  if (!id) return notFound();
  try {
    await createClientLink(id, partner);
    return NextResponse.json(await getStaffClientLink(id), { status: 201 });
  } catch (err) {
    return financeErrorResponse(err, 'create client link');
  }
});

// Staff: revoke the live link; the client can no longer open it.
export const DELETE = withPartner<Request, Params>(async (_req, { params, partner }) => {
  const id = await quoteId(params);
  if (!id) return notFound();
  try {
    await revokeClientLink(id, partner);
    return NextResponse.json(await getStaffClientLink(id));
  } catch (err) {
    return financeErrorResponse(err, 'revoke client link');
  }
});
