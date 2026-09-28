// Helpers for the append-only finance audit log: what changed between two
// snapshots of a record, for the "history" view. Bookkeeping fields that
// change on every write are ignored so the history shows real edits only.

const IGNORED_FIELDS = new Set(['updatedAt', 'updatedByEmail']);

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): FieldChange[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: FieldChange[] = [];
  for (const field of [...keys].sort()) {
    if (IGNORED_FIELDS.has(field)) continue;
    const b = before?.[field] ?? null;
    const a = after?.[field] ?? null;
    if (JSON.stringify(b) !== JSON.stringify(a)) changes.push({ field, before: b, after: a });
  }
  return changes;
}
