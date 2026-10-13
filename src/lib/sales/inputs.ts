// Turns what is typed into the quote builder's fields into the integers the
// calculator and API use. String arithmetic only, like parseAmountToCents,
// so "12.5%" is exactly 1250 basis points.

import { centsToInput, parseAmountToCents } from '../money';
import { MAX_AMOUNT_CENTS } from '../finance/types';
import { MAX_ITEM_QUANTITY, MAX_PERCENT_BP } from './types';

export type Parsed = { ok: true; value: number } | { ok: false; error: string };

// A price that may be $0 (a complimentary item), unlike expense amounts.
export function parsePriceToCents(input: string): Parsed {
  if (/^\s*\$?\s*0*(?:[.,]0*)?\s*$/.test(input) && /\d/.test(input)) return { ok: true, value: 0 };
  const parsed = parseAmountToCents(input, MAX_AMOUNT_CENTS);
  return parsed.ok ? { ok: true, value: parsed.cents } : { ok: false, error: parsed.error };
}

// "13", "12.5", "12.50%" -> basis points. At most two decimals.
export function parsePercentToBp(input: string, maxBp = MAX_PERCENT_BP): Parsed {
  const s = input.trim().replace(/\s*%$/, '').replace(',', '.');
  if (!s) return { ok: false, error: 'Enter a percentage' };
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m || (m[1] === '' && !m[2])) return { ok: false, error: 'Enter a percentage, e.g. 13 or 12.5' };
  const bp = Number(m[1] || '0') * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  if (bp > maxBp) return { ok: false, error: `Can't be more than ${maxBp / 100}%` };
  return { ok: true, value: bp };
}

export function parseQuantity(input: string): Parsed {
  const s = input.trim();
  if (!/^\d+$/.test(s)) return { ok: false, error: 'Whole number' };
  const n = Number(s);
  if (n < 1) return { ok: false, error: 'At least 1' };
  if (n > MAX_ITEM_QUANTITY) return { ok: false, error: `At most ${MAX_ITEM_QUANTITY.toLocaleString('en-CA')}` };
  return { ok: true, value: n };
}

// 1250 -> "12.5", 1300 -> "13": the editable form of a stored rate.
export function bpToInput(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const frac = String(bp % 100).padStart(2, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

// 1250 -> "12.5%".
export function formatBp(bp: number): string {
  return `${bpToInput(bp)}%`;
}

// Editable form of a price: 240000 -> "2400.00", 0 -> "0".
export function priceToInput(cents: number): string {
  return cents === 0 ? '0' : centsToInput(cents);
}
