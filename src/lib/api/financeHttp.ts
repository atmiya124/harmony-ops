import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';
import { FinanceError } from '../db/financeRepo';

// Shared response shapes for the finance API, so the forms can show
// field-level messages: { error, fieldErrors?: { field: [messages] } }.

export function badRequest(error: string, fieldErrors?: Record<string, string[]>) {
  return NextResponse.json({ error, fieldErrors }, { status: 400 });
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => undefined);
}

export function parseBody<S extends ZodType>(schema: S, body: unknown): { ok: true; data: z.output<S> } | { ok: false; response: NextResponse } {
  if (body === undefined) return { ok: false, response: badRequest('Request body must be JSON') };
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = result.error.issues[0];
  return { ok: false, response: badRequest(first ? first.message : 'Invalid input', fieldErrors) };
}

// Maps rule violations to 4xx; anything unexpected is logged and returned
// as a generic 500 so internal details (SQL, storage errors) never leak.
export function financeErrorResponse(err: unknown, context: string) {
  if (err instanceof FinanceError) {
    return NextResponse.json({ error: err.message, fieldErrors: err.fieldErrors, current: err.current }, { status: err.status });
  }
  console.error(`[finance] ${context} failed:`, err);
  return NextResponse.json({ error: 'Something went wrong saving this. Please try again.' }, { status: 500 });
}
