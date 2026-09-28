// Event-level financial summary. "Estimated profit" is agreed pre-tax
// revenue minus recorded costs — not cash received. Payments aren't tracked
// until Phase 2, so the UI must always label it as an estimate.

import { expenseCostCents, splitAgreedAmount } from './tax';
import type { AmountStatus, HstTreatment } from './types';

interface AgreedAmount {
  agreedAmountCents: number;
  amountStatus: AmountStatus;
  hstTreatment: HstTreatment;
  hstRateBp: number;
}

interface ExpenseForProfit {
  amountCents: number;
  taxCents: number;
  deletedAt: string | null;
}

export interface EventFinancialSummary {
  agreed: {
    netCents: number; // pre-tax revenue — the profit baseline
    hstCents: number;
    grossCents: number; // what the client pays
    status: AmountStatus;
  } | null; // null until an agreed amount is entered
  expensesPaidCents: number; // total money out, tax included
  expenseCostCents: number; // cost after recoverable HST (see expenseCostCents)
  expenseCount: number;
  // null when there's no agreed amount — a profit figure with no revenue
  // side would just be the negative of expenses, which misleads.
  estimatedProfitCents: number | null;
}

export function summarizeEvent(agreed: AgreedAmount | null, expenses: ExpenseForProfit[], hstRegistered: boolean): EventFinancialSummary {
  const live = expenses.filter((e) => !e.deletedAt);
  const expensesPaidCents = live.reduce((sum, e) => sum + e.amountCents, 0);
  const costCents = live.reduce((sum, e) => sum + expenseCostCents(e.amountCents, e.taxCents, hstRegistered), 0);

  if (!agreed) {
    return { agreed: null, expensesPaidCents, expenseCostCents: costCents, expenseCount: live.length, estimatedProfitCents: null };
  }
  const split = splitAgreedAmount(agreed.agreedAmountCents, agreed.hstTreatment, agreed.hstRateBp);
  return {
    agreed: { netCents: split.netCents, hstCents: split.hstCents, grossCents: split.grossCents, status: agreed.amountStatus },
    expensesPaidCents,
    expenseCostCents: costCents,
    expenseCount: live.length,
    estimatedProfitCents: split.netCents - costCents,
  };
}
