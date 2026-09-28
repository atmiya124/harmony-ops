// Per-device conveniences only (never financial data): the payment method a
// partner last used, so the next expense is one tap shorter. Storage can be
// unavailable (private browsing, blocked site data) — every access is
// wrapped so the app works identically without it.
import { FUNDING_SOURCES, PAYMENT_METHODS, type FundingSource, type PaymentMethod } from './finance/types';

const KEY = 'harmony.expensePrefs.v1';

export interface ExpensePrefs {
  paymentMethod?: PaymentMethod;
  // Last choice of whose money cash / e-transfers were (the card methods
  // decide this themselves).
  fundingForCashLike?: FundingSource;
}

export function readExpensePrefs(): ExpensePrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    return {
      paymentMethod: PAYMENT_METHODS.includes(raw.paymentMethod) ? raw.paymentMethod : undefined,
      fundingForCashLike: FUNDING_SOURCES.includes(raw.fundingForCashLike) ? raw.fundingForCashLike : undefined,
    };
  } catch {
    return {};
  }
}

export function writeExpensePrefs(prefs: ExpensePrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readExpensePrefs(), ...prefs }));
  } catch {
    // Not critical — the next expense just starts from the defaults.
  }
}
