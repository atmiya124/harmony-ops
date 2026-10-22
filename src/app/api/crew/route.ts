import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { createCrewMember, listCrew } from '@/lib/db/labourRepo';
import { crewMemberCreateSchema } from '@/lib/schemas/finance';
import { financeErrorResponse, parseBody, readJson } from '@/lib/api/financeHttp';

// The crew / contractor directory, with what each has earned and is owed.
export const GET = withPartner(async () => {
  try {
    return NextResponse.json(await listCrew());
  } catch (err) {
    return financeErrorResponse(err, 'list crew');
  }
});

export const POST = withPartner(async (req, { partner }) => {
  const body = parseBody(crewMemberCreateSchema, await readJson(req));
  if (!body.ok) return body.response;
  try {
    return NextResponse.json(await createCrewMember(body.data, partner), { status: 201 });
  } catch (err) {
    return financeErrorResponse(err, 'add crew member');
  }
});
