import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPartner } from '@/lib/auth/session';
import { getCrewMember, updateCrewMember } from '@/lib/db/labourRepo';
import { crewMemberUpdateSchema } from '@/lib/schemas/finance';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

interface Params {
  params: Promise<{ id: string }>;
}

const notFound = () => NextResponse.json({ error: 'Crew member not found' }, { status: 404 });

// A crew profile with the events they've worked and what they're owed.
export const GET = withPartner<Request, Params>(async (_req, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  try {
    const member = await getCrewMember(id);
    return member ? NextResponse.json(member) : notFound();
  } catch (err) {
    return financeErrorResponse(err, 'load crew member');
  }
});

export const PATCH = withPartner<Request, Params>(async (req, { params, partner }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();
  const body = parseBody(crewMemberUpdateSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await updateCrewMember(id, body.data, partner));
  } catch (err) {
    return financeErrorResponse(err, 'update crew member');
  }
});
