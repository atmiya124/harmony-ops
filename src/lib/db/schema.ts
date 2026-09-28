import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import {
  AMOUNT_STATUSES,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  CURRENCY,
  DEFAULT_HST_RATE_BP,
  EXPENSE_CATEGORIES,
  FUNDING_SOURCES,
  HST_TREATMENTS,
  MAX_AMOUNT_CENTS,
  MAX_HST_RATE_BP,
  PAYMENT_METHODS,
  REIMBURSEMENT_METHODS,
} from '../finance/types';

// These three tables and `users` already exist in this Turso database,
// shared with another app (Event-booking-app) — this schema matches their
// EXACT existing structure (columns, types, defaults) rather than
// introducing a new shape. Nothing here alters or adds columns to them.
export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventTitle: text('event_title').notNull(),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  clientEmail: text('client_email').notNull(),
  eventDate: text('event_date').notNull(),
  setupTime: text('setup_time').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  venueName: text('venue_name').notNull(),
  venueAddress: text('venue_address').notNull(),
  eventType: text('event_type').notNull(),
  notes: text('notes'),
  status: text('status', { enum: ['Tentative', 'Confirmed', 'Completed', 'Cancelled'] })
    .notNull()
    .default('Tentative'),
  createdBy: integer('created_by'),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
  pickupDate: text('pickup_date'),
  pickupTime: text('pickup_time'),
});

export const bookingEquipment = sqliteTable('booking_equipment', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookingId: integer('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  itemName: text('item_name').notNull(),
  spec: text('spec'),
  qty: integer('qty').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const bookingServices = sqliteTable('booking_services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookingId: integer('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  serviceName: text('service_name').notNull(),
});

export const partnerSettings = sqliteTable('partner_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyName: text('company_name'),
  partnerEmail1: text('partner_email_1'),
  partnerEmail2: text('partner_email_2'),
  partnerEmail3: text('partner_email_3'),
  partnerEmail4: text('partner_email_4'),
  reminder7Days: integer('reminder_7_days', { mode: 'boolean' }),
  reminder2Days: integer('reminder_2_days', { mode: 'boolean' }),
  reminder1Day: integer('reminder_1_day', { mode: 'boolean' }),
  updatedAt: text('updated_at'),
  autoCompleteEvents: integer('auto_complete_events', { mode: 'boolean' }),
  autoCancelTentativeDays: integer('auto_cancel_tentative_days'),
  flagOverduePickups: integer('flag_overdue_pickups', { mode: 'boolean' }),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

// New table, introduced by harmony-ops — does not conflict with anything
// that already exists in this database.
export const equipmentCatalog = sqliteTable('equipment_catalog', {
  id: text('id').primaryKey(),
  itemName: text('item_name').notNull(),
  category: text('category', { enum: ['led_panel', 'stage_panel', 'audio', 'lighting', 'other'] }).notNull(),
  pixelPitch: real('pixel_pitch'),
  panelWidth: real('panel_width'),
  panelHeight: real('panel_height'),
  powerDrawWatts: real('power_draw_watts'),
  // Comma-separated match terms, e.g. "led wall,led screen,video wall"
  keywords: text('keywords').notNull().default(''),
});

// New table, introduced by harmony-ops — does not conflict with anything
// that already exists in this database. Singleton row (id 1) holding the
// per-unit rates used by the LED and stage pricing sections.
export const pricingSettings = sqliteTable('pricing_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ledPricePerSqft: real('led_price_per_sqft').notNull().default(17),
  stagePricePerPanel: real('stage_price_per_panel').notNull().default(85),
  updatedAt: text('updated_at'),
});

// New table, introduced by harmony-ops — does not conflict with anything
// that already exists in this database. Background audit trail for the
// "paste email to pre-fill" AI flow: what was pasted, what the model
// extracted, and what the staff member changed before saving. No UI reads
// this yet — it exists purely so extraction quality/edits can be reviewed
// later, directly in the database.
export const aiExtractionAudit = sqliteTable('ai_extraction_audit', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookingId: integer('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  rawText: text('raw_text').notNull(),
  aiResult: text('ai_result').notNull(), // JSON: the model's extracted draft, pre-edit
  changes: text('changes').notNull(), // JSON: field-level diff between the draft and what was saved
  model: text('model').notNull(),
  createdAt: text('created_at').notNull(),
});

// New tables, introduced by harmony-ops for Better Auth (Google sign-in).
// Prefixed `auth_` so they can never collide with the shared `users` table
// (owned by Event-booking-app) or any Better Auth default name another app
// sharing this database might adopt later. Property keys must match Better
// Auth's field names — the drizzle adapter addresses columns by key — while
// the SQL column names stay snake_case like the rest of this database.
export const authUser = sqliteTable('auth_user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const authSession = sqliteTable(
  'auth_session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
  },
  (t) => [index('auth_session_user_id_idx').on(t.userId)],
);

export const authAccount = sqliteTable(
  'auth_account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('auth_account_user_id_idx').on(t.userId)],
);

export const authVerification = sqliteTable(
  'auth_verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('auth_verification_identifier_idx').on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Finance (Phase 1). New tables, introduced by harmony-ops.
//
// Money is always integer cents (CAD) — never REAL — so totals are exact.
//
// No foreign keys point at the shared `bookings` table: a database-level
// constraint there could block Event-booking-app from deleting a booking, or
// cascade-delete financial records when it does. `booking_id` is validated
// by the app instead, and a record whose booking is later deleted is kept
// and shown as belonging to a deleted event — financial history is never
// lost. Partners are identified by email (the PARTNER_EMAILS allowlist), so
// all four can be selected as "paid by" even before they first sign in.
//
// Phase 2 (quotes, invoices, payments) will add its own tables keyed the
// same way (booking_id + integer cents) and reuse attachments and the audit
// log; nothing here needs to change for that.
// ---------------------------------------------------------------------------

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

// Receipt files live in private object storage; only metadata and the
// storage reference are kept here. Generic so quotes/invoices can reuse it.
export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    storageProvider: text('storage_provider').notNull(), // e.g. 'vercel_blob'
    storageKey: text('storage_key').notNull(), // provider path/key — never a public URL
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    originalFilename: text('original_filename'),
    uploadedByUserId: text('uploaded_by_user_id').notNull(),
    uploadedByEmail: text('uploaded_by_email').notNull(),
    createdAt: text('created_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => [uniqueIndex('attachments_storage_key_unique').on(t.storageProvider, t.storageKey), check('attachments_size_positive', sql`${t.sizeBytes} > 0`)],
);

export const expenses = sqliteTable(
  'expenses',
  {
    // Client-generated UUID, so a retried save from a flaky phone connection
    // can't create a duplicate expense.
    id: text('id').primaryKey(),
    bookingId: integer('booking_id'), // null = general business expense
    category: text('category', { enum: EXPENSE_CATEGORIES }).notNull(),
    amountCents: integer('amount_cents').notNull(), // total paid, tax included
    // The HST portion of amount_cents, when the receipt shows it. 0 = none or
    // unknown; never assumed.
    taxCents: integer('tax_cents').notNull().default(0),
    currency: text('currency').notNull().default(CURRENCY),
    expenseDate: text('expense_date').notNull(), // YYYY-MM-DD, local date of purchase
    paidByEmail: text('paid_by_email').notNull(),
    paymentMethod: text('payment_method', { enum: PAYMENT_METHODS }).notNull(),
    fundingSource: text('funding_source', { enum: FUNDING_SOURCES }).notNull(),
    // Whether the partner is owed this money back. Always false for company
    // money; a partner can also waive it ("Not required"). How much has been
    // paid back lives in `reimbursements` — the outstanding balance and the
    // pending/partial/reimbursed status are always derived, never stored, so
    // they can't drift out of sync with the payment history.
    reimbursable: integer('reimbursable', { mode: 'boolean' }).notNull(),
    receiptAttachmentId: text('receipt_attachment_id').references(() => attachments.id),
    notes: text('notes'),
    createdByUserId: text('created_by_user_id').notNull(),
    createdByEmail: text('created_by_email').notNull(),
    updatedByEmail: text('updated_by_email').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    // Soft delete: removed from totals, kept for the audit trail.
    deletedAt: text('deleted_at'),
    deletedByEmail: text('deleted_by_email'),
  },
  (t) => [
    index('expenses_booking_id_idx').on(t.bookingId),
    index('expenses_expense_date_idx').on(t.expenseDate),
    index('expenses_paid_by_email_idx').on(t.paidByEmail),
    // One receipt belongs to one expense.
    uniqueIndex('expenses_receipt_attachment_unique').on(t.receiptAttachmentId),
    check('expenses_amount_range', sql`${t.amountCents} > 0 AND ${t.amountCents} <= ${sql.raw(String(MAX_AMOUNT_CENTS))}`),
    check('expenses_tax_within_amount', sql`${t.taxCents} >= 0 AND ${t.taxCents} < ${t.amountCents}`),
    check('expenses_category_valid', sql`${t.category} IN (${inList(EXPENSE_CATEGORIES)})`),
    check('expenses_payment_method_valid', sql`${t.paymentMethod} IN (${inList(PAYMENT_METHODS)})`),
    check('expenses_funding_source_valid', sql`${t.fundingSource} IN (${inList(FUNDING_SOURCES)})`),
    // Company money is never reimbursed to anyone.
    check('expenses_company_not_reimbursable', sql`${t.fundingSource} = 'personal' OR ${t.reimbursable} = 0`),
    check('expenses_date_format', sql`${t.expenseDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
  ],
);

// Money paid back to a partner against one expense. Several rows = partial
// payments (e.g. $300 now, $200 later on a $500 expense). A reimbursement is
// never an expense, so paying a partner back can't double-count spending.
// Mistakes are voided with a reason, never deleted, so the history stays
// complete. The app keeps the live (non-voided) total at or below the
// expense amount inside a transaction; SQLite CHECKs can't sum rows.
export const reimbursements = sqliteTable(
  'reimbursements',
  {
    id: text('id').primaryKey(), // client-generated UUID, same retry safety as expenses
    expenseId: text('expense_id')
      .notNull()
      .references(() => expenses.id),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default(CURRENCY),
    reimbursedOn: text('reimbursed_on').notNull(), // YYYY-MM-DD the partner was paid
    method: text('method', { enum: REIMBURSEMENT_METHODS }).notNull(),
    notes: text('notes'),
    recordedByUserId: text('recorded_by_user_id').notNull(),
    recordedByEmail: text('recorded_by_email').notNull(),
    createdAt: text('created_at').notNull(),
    voidedAt: text('voided_at'),
    voidedByEmail: text('voided_by_email'),
    voidReason: text('void_reason'),
  },
  (t) => [
    index('reimbursements_expense_id_idx').on(t.expenseId),
    check('reimbursements_amount_range', sql`${t.amountCents} > 0 AND ${t.amountCents} <= ${sql.raw(String(MAX_AMOUNT_CENTS))}`),
    check('reimbursements_method_valid', sql`${t.method} IN (${inList(REIMBURSEMENT_METHODS)})`),
    check('reimbursements_date_format', sql`${t.reimbursedOn} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
    // A void always records who and why.
    check('reimbursements_void_complete', sql`${t.voidedAt} IS NULL OR (${t.voidedByEmail} IS NOT NULL AND ${t.voidReason} IS NOT NULL)`),
  ],
);

// One row per booking holding the final agreed amount. Created the first
// time a partner enters an amount; history lives in finance_audit_log.
export const eventFinancials = sqliteTable(
  'event_financials',
  {
    bookingId: integer('booking_id').primaryKey(),
    agreedAmountCents: integer('agreed_amount_cents').notNull(),
    currency: text('currency').notNull().default(CURRENCY),
    amountStatus: text('amount_status', { enum: AMOUNT_STATUSES }).notNull(),
    hstTreatment: text('hst_treatment', { enum: HST_TREATMENTS }).notNull(),
    // The rate this amount was agreed at, so a later rate change never
    // rewrites past figures.
    hstRateBp: integer('hst_rate_bp').notNull(),
    notes: text('notes'),
    createdByEmail: text('created_by_email').notNull(),
    updatedByEmail: text('updated_by_email').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check('event_financials_amount_range', sql`${t.agreedAmountCents} >= 0 AND ${t.agreedAmountCents} <= ${sql.raw(String(MAX_AMOUNT_CENTS))}`),
    check('event_financials_status_valid', sql`${t.amountStatus} IN (${inList(AMOUNT_STATUSES)})`),
    check('event_financials_hst_treatment_valid', sql`${t.hstTreatment} IN (${inList(HST_TREATMENTS)})`),
    check('event_financials_hst_rate_range', sql`${t.hstRateBp} >= 0 AND ${t.hstRateBp} <= ${sql.raw(String(MAX_HST_RATE_BP))}`),
  ],
);

// Singleton (id = 1). Whether Harmony Production is HST-registered decides
// whether HST paid on expenses is recoverable (and so excluded from cost).
// Defaults are conservative: not registered, 13%.
export const financeSettings = sqliteTable(
  'finance_settings',
  {
    id: integer('id').primaryKey(),
    hstRegistered: integer('hst_registered', { mode: 'boolean' }).notNull().default(false),
    defaultHstRateBp: integer('default_hst_rate_bp').notNull().default(DEFAULT_HST_RATE_BP),
    updatedByEmail: text('updated_by_email'),
    updatedAt: text('updated_at'),
  },
  (t) => [
    check('finance_settings_singleton', sql`${t.id} = 1`),
    check('finance_settings_hst_rate_range', sql`${t.defaultHstRateBp} >= 0 AND ${t.defaultHstRateBp} <= ${sql.raw(String(MAX_HST_RATE_BP))}`),
  ],
);

// Append-only history of every financial change: who, when, and the full
// record before and after. Rows are never updated or deleted.
export const financeAuditLog = sqliteTable(
  'finance_audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entityType: text('entity_type', { enum: AUDIT_ENTITY_TYPES }).notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action', { enum: AUDIT_ACTIONS }).notNull(),
    changedByUserId: text('changed_by_user_id').notNull(),
    changedByEmail: text('changed_by_email').notNull(),
    changedAt: text('changed_at').notNull(),
    before: text('before'), // JSON snapshot; null on create
    after: text('after'), // JSON snapshot; null on hard delete (never used)
  },
  (t) => [
    index('finance_audit_log_entity_idx').on(t.entityType, t.entityId),
    check('finance_audit_log_entity_type_valid', sql`${t.entityType} IN (${inList(AUDIT_ENTITY_TYPES)})`),
    check('finance_audit_log_action_valid', sql`${t.action} IN (${inList(AUDIT_ACTIONS)})`),
  ],
);

export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;
export type BookingEquipmentRow = typeof bookingEquipment.$inferSelect;
export type NewBookingEquipmentRow = typeof bookingEquipment.$inferInsert;
export type BookingServiceRow = typeof bookingServices.$inferSelect;
export type NewBookingServiceRow = typeof bookingServices.$inferInsert;
export type EquipmentCatalogRow = typeof equipmentCatalog.$inferSelect;
export type NewEquipmentCatalogRow = typeof equipmentCatalog.$inferInsert;
export type PricingSettingsRow = typeof pricingSettings.$inferSelect;
export type NewPricingSettingsRow = typeof pricingSettings.$inferInsert;
export type AiExtractionAuditRow = typeof aiExtractionAudit.$inferSelect;
export type NewAiExtractionAuditRow = typeof aiExtractionAudit.$inferInsert;
export type AttachmentRow = typeof attachments.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
export type NewExpenseRow = typeof expenses.$inferInsert;
export type EventFinancialsRow = typeof eventFinancials.$inferSelect;
export type FinanceSettingsRow = typeof financeSettings.$inferSelect;
export type FinanceAuditLogRow = typeof financeAuditLog.$inferSelect;
export type ReimbursementRow = typeof reimbursements.$inferSelect;
