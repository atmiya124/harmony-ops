// The finance vocabulary shared by the database schema, server validation
// and UI. Stored values are stable snake_case keys; labels are display-only
// and can change freely.

export const EXPENSE_CATEGORIES = [
  'equipment_rental',
  'equipment_purchase',
  'transportation_fuel',
  'crew',
  'food',
  'maintenance',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  equipment_rental: 'Equipment Rental',
  equipment_purchase: 'Equipment Purchase',
  transportation_fuel: 'Transportation / Fuel',
  crew: 'Crew',
  food: 'Food',
  maintenance: 'Maintenance',
  other: 'Other',
};

export const PAYMENT_METHODS = ['personal_card', 'company_card', 'cash', 'etransfer'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  personal_card: 'Personal Card',
  company_card: 'Company Card',
  cash: 'Cash',
  etransfer: 'E-Transfer',
};

// Whose money paid for it. Separate from the payment method because cash
// and e-transfers can come from either a partner or the company.
export const FUNDING_SOURCES = ['personal', 'company'] as const;
export type FundingSource = (typeof FUNDING_SOURCES)[number];

// Derived from the expense and its reimbursement payments — never stored.
export const REIMBURSEMENT_STATUSES = ['pending', 'partial', 'reimbursed', 'not_required'] as const;
export type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];

export const REIMBURSEMENT_STATUS_LABELS: Record<ReimbursementStatus, string> = {
  pending: 'Pending',
  partial: 'Partially Reimbursed',
  reimbursed: 'Reimbursed',
  not_required: 'Not Required',
};

// How the company paid a partner back.
export const REIMBURSEMENT_METHODS = ['etransfer', 'cash', 'cheque', 'bank_transfer'] as const;
export type ReimbursementMethod = (typeof REIMBURSEMENT_METHODS)[number];

export const REIMBURSEMENT_METHOD_LABELS: Record<ReimbursementMethod, string> = {
  etransfer: 'E-Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
};

// Event agreed amounts.
export const AMOUNT_STATUSES = ['estimated', 'confirmed'] as const;
export type AmountStatus = (typeof AMOUNT_STATUSES)[number];

// How HST relates to the agreed amount: `excluded` = HST is charged on top,
// `included` = the amount already contains HST, `exempt` = no HST applies.
export const HST_TREATMENTS = ['excluded', 'included', 'exempt'] as const;
export type HstTreatment = (typeof HST_TREATMENTS)[number];

export const HST_TREATMENT_LABELS: Record<HstTreatment, string> = {
  excluded: 'Plus HST',
  included: 'Includes HST',
  exempt: 'No HST',
};

export const AUDIT_ENTITY_TYPES = ['expense', 'reimbursement', 'attachment', 'event_financials', 'finance_settings'] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = ['create', 'update', 'delete', 'restore', 'void'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const CURRENCY = 'CAD';

// Guard rails, in cents: nothing Harmony Production records should reach a
// million dollars, so anything above is almost certainly a typo (e.g. an
// extra zero or cents typed as dollars).
export const MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000.00

// Ontario HST, in basis points (13.00%). Only the default for new records;
// every record stores the rate it was calculated with.
export const DEFAULT_HST_RATE_BP = 1300;
export const MAX_HST_RATE_BP = 3000;
