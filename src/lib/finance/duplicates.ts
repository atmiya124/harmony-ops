// Spotting an accidental double entry before it's saved: the same amount on
// the same day (or the day either side, for entries made after midnight or
// with the date picked differently). Only a warning — two identical
// coffees are legitimate — so it never blocks saving.

interface Candidate {
  id?: string; // the expense being edited, which must not match itself
  amountCents: number;
  expenseDate: string;
}

interface Existing {
  id: string;
  amountCents: number;
  expenseDate: string;
  deletedAt: string | null;
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function findLikelyDuplicate<T extends Existing>(candidate: Candidate, existing: T[]): T | null {
  if (!candidate.amountCents || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.expenseDate)) return null;
  const day = dayNumber(candidate.expenseDate);
  return (
    existing.find(
      (e) => !e.deletedAt && e.id !== candidate.id && e.amountCents === candidate.amountCents && Math.abs(dayNumber(e.expenseDate) - day) <= 1,
    ) ?? null
  );
}
