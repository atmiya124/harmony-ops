// Hourly crew labour: outsourced helpers paid by the hour for an event.
// Hours are stored as whole minutes and rates as cents per hour, so a line's
// earned amount is exact integer arithmetic with one rounding to the cent.
//
// Earned and paid are separate. Entering hours means "Harmony owes this";
// payments are recorded later, one or more per person. What's still owed
// and the Unpaid / Partially paid / Paid status are always derived from the
// two, never stored — so adding hours after someone was paid simply leaves
// the new hours owing, and old payments are never rewritten.

import type { ExpenseKind } from './types';

export const MAX_LABOUR_LINES = 20;
export const MAX_LABOUR_MINUTES = 24 * 60; // one person, one entry
export const MAX_WORKER_NAME = 80;
export const MAX_CREW_ROLE = 60;

export interface LabourLineValues {
  workerName: string;
  minutes: number;
  rateCents: number; // per hour
}

export type ParsedHours = { ok: true; minutes: number } | { ok: false; error: string };

// "3", "6.5", "6,5", "6:30", "11:45", "6h", "6h30" → minutes. Decimal hours
// are rounded to the nearest minute (so "0.1" is 6 minutes).
export function parseHours(input: string): ParsedHours {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return { ok: false, error: 'Enter hours' };
  let minutes: number;
  const clock = /^(\d{1,2})(?::|h)(\d{0,2})m?$/.exec(s);
  if (clock) {
    const m = clock[2] === '' ? 0 : Number(clock[2]);
    if (m >= 60) return { ok: false, error: 'Minutes must be under 60' };
    minutes = Number(clock[1]) * 60 + m;
  } else {
    const decimal = /^(\d{0,2})(?:[.,](\d{1,2}))?h?$/.exec(s);
    if (!decimal || (decimal[1] === '' && !decimal[2])) return { ok: false, error: 'Enter hours like 6.5 or 6:30' };
    const hours = Number(`${decimal[1] || '0'}.${decimal[2] ?? '0'}`);
    minutes = Math.round(hours * 60);
  }
  if (minutes <= 0) return { ok: false, error: 'Hours must be more than 0' };
  if (minutes > MAX_LABOUR_MINUTES) return { ok: false, error: "Hours can't exceed 24 in one entry" };
  return { ok: true, minutes };
}

export function lineAmountCents(minutes: number, rateCents: number): number {
  return Math.round((minutes * rateCents) / 60);
}

// 390 → "6.5", 400 → "6:40" — whichever reads naturally.
export function formatHours(minutes: number): string {
  if (minutes % 15 === 0 || minutes % 6 === 0) return String(Number((minutes / 60).toFixed(2)));
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export function summarizeLabour(lines: { minutes: number; rateCents: number }[]): { people: number; minutes: number; amountCents: number } {
  return {
    people: lines.length,
    minutes: lines.reduce((sum, l) => sum + l.minutes, 0),
    amountCents: lines.reduce((sum, l) => sum + lineAmountCents(l.minutes, l.rateCents), 0),
  };
}

// "3 people · 19.5 h"
export function labourSummaryLabel(summary: { people: number; minutes: number }): string {
  return `${summary.people} ${summary.people === 1 ? 'person' : 'people'} · ${formatHours(summary.minutes)} h`;
}

// ---------------------------------------------------------------------------
// Earned vs paid
// ---------------------------------------------------------------------------

export const LABOUR_PAY_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export type LabourPayStatus = (typeof LABOUR_PAY_STATUSES)[number];

export const LABOUR_PAY_STATUS_LABELS: Record<LabourPayStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
};

export interface LabourPayState {
  earnedCents: number;
  paidCents: number;
  remainingCents: number; // never negative
  status: LabourPayStatus;
}

// Only live (not removed) payments count.
export function labourPayState(earnedCents: number, payments: { amountCents: number; deletedAt?: string | null }[]): LabourPayState {
  const paidCents = payments.filter((p) => !p.deletedAt).reduce((sum, p) => sum + p.amountCents, 0);
  const remainingCents = Math.max(0, earnedCents - paidCents);
  const status: LabourPayStatus = paidCents <= 0 ? 'unpaid' : remainingCents > 0 ? 'partial' : 'paid';
  return { earnedCents, paidCents, remainingCents, status };
}

export function totalPayState(states: LabourPayState[]): LabourPayState {
  const earned = states.reduce((s, x) => s + x.earnedCents, 0);
  const paid = states.reduce((s, x) => s + x.paidCents, 0);
  const remaining = states.reduce((s, x) => s + x.remainingCents, 0);
  return { earnedCents: earned, paidCents: paid, remainingCents: remaining, status: paid <= 0 ? 'unpaid' : remaining > 0 ? 'partial' : 'paid' };
}

// Whole percent paid, rounded down so it only reads 100 once fully paid (and
// at least 1 once anything is).
export function paidPercent(state: Pick<LabourPayState, 'earnedCents' | 'paidCents'>): number {
  if (state.earnedCents <= 0 || state.paidCents <= 0) return 0;
  if (state.paidCents >= state.earnedCents) return 100;
  return Math.max(1, Math.floor((state.paidCents * 100) / state.earnedCents));
}

export type Check = { ok: true } | { ok: false; error: string };

// A payment can settle what's owed but never more, so "paid" can't run ahead
// of the hours actually worked.
export function checkLabourPayment(state: LabourPayState, amountCents: number): Check {
  if (state.remainingCents <= 0) return { ok: false, error: 'Nothing is owed for this person' };
  if (amountCents > state.remainingCents) return { ok: false, error: `Only ${centsText(state.remainingCents)} is owed` };
  return { ok: true };
}

// Saving a changed set of lines. Hours can always go up (the extra simply
// becomes owed). A person who has been paid can't be removed, and their
// earned amount can't drop below what they've already been paid — remove a
// payment first — so payment history never has to change.
export function checkLabourEdit(
  existing: { id: string; workerName: string; paidCents: number }[],
  next: { id: string; minutes: number; rateCents: number }[],
): Check {
  const byId = new Map(next.map((l) => [l.id, l]));
  for (const line of existing) {
    if (line.paidCents <= 0) continue;
    const updated = byId.get(line.id);
    if (!updated) return { ok: false, error: `${line.workerName} has been paid ${centsText(line.paidCents)}, so they can't be removed. Remove the payment first.` };
    if (lineAmountCents(updated.minutes, updated.rateCents) < line.paidCents) {
      return { ok: false, error: `${line.workerName} has already been paid ${centsText(line.paidCents)}; their hours can't add up to less. Remove the payment first.` };
    }
  }
  return { ok: true };
}

function centsText(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// ---------------------------------------------------------------------------
// Which totals a row belongs to (see EXPENSE_KINDS)
// ---------------------------------------------------------------------------

// Spending, categories, event cost and profit.
export const countsAsCost = (e: { kind: ExpenseKind }) => e.kind !== 'labour_payment';
// Who paid for what, partner spend, and reimbursement.
export const countsAsOutlay = (e: { kind: ExpenseKind }) => e.kind !== 'labour';
