import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import {
  AMOUNT_STATUSES,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  CURRENCY,
  DEFAULT_HST_RATE_BP,
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  FUNDING_SOURCES,
  HST_TREATMENTS,
  MAX_AMOUNT_CENTS,
  MAX_HST_RATE_BP,
  PAYMENT_METHODS,
  REIMBURSEMENT_METHODS,
} from '../finance/types';
import { MAX_CREW_ROLE, MAX_LABOUR_MINUTES, MAX_WORKER_NAME } from '../finance/labour';
import {
  ADJUSTMENT_TYPES,
  DOCUMENT_SEQUENCES,
  INVOICE_STATUSES,
  MAX_ITEM_QUANTITY,
  MAX_PERCENT_BP,
  QUOTE_STATUSES,
  SALES_AUDIT_ACTIONS,
  SALES_AUDIT_ENTITY_TYPES,
  ACTIVITY_ACTORS,
  MAX_SIGNATURE_DATA_LENGTH,
  QUOTE_ACTIVITY_EVENTS,
  QUOTE_EMAIL_SEND_KINDS,
  QUOTE_PAYMENT_METHODS,
  QUOTE_CLIENT_TYPES,
  QUOTE_RESPONSE_ACTIONS,
  SIGNATURE_TYPES,
} from '../sales/types';

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
    // See EXPENSE_KINDS. A `labour` row is an event's crew labour: its amount
    // is what the crew earned (the sum of its expense_labour_lines), and its
    // payer columns only say who recorded it (company, never reimbursable).
    // A `labour_payment` row is a real payment to the crew person on
    // `labour_line_id`. Checked by the app: SQLite can't add a CHECK to an
    // existing table without rebuilding it.
    kind: text('kind', { enum: EXPENSE_KINDS }).notNull().default('expense'),
    labourLineId: text('labour_line_id'),
    reference: text('reference'), // e.g. an e-transfer or cheque number
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

// The crew / contractor directory: outsourced people Harmony hires by the
// hour, so their contact details and usual rate are on hand. Not payroll:
// everything but the name is optional. A profile only supplies defaults —
// each event's labour line keeps its own copy of the name, role and rate
// used, so editing a profile never changes past labour.
export const crewMembers = sqliteTable(
  'crew_members',
  {
    id: text('id').primaryKey(), // client-generated UUID
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    role: text('role'), // e.g. LED Tech, Stagehand
    company: text('company'),
    defaultRateCents: integer('default_rate_cents'), // per hour
    notes: text('notes'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdByEmail: text('created_by_email').notNull(),
    updatedByEmail: text('updated_by_email').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('crew_members_name_idx').on(t.name),
    check('crew_members_name_length', sql`length(${t.name}) BETWEEN 1 AND ${sql.raw(String(MAX_WORKER_NAME))}`),
    check('crew_members_rate_range', sql`${t.defaultRateCents} IS NULL OR (${t.defaultRateCents} > 0 AND ${t.defaultRateCents} <= ${sql.raw(String(MAX_AMOUNT_CENTS))})`),
  ],
);

// One crew person's hours on an event's `labour` expense: a snapshot of the
// name, role and rate actually used (crew_member_id links the profile when
// there is one; null = a one-off person). The parent expense's amount is
// always the sum of its lines' amounts, worked out on the server. Line ids
// are stable across edits, because payments point at them.
export const expenseLabourLines = sqliteTable(
  'expense_labour_lines',
  {
    id: text('id').primaryKey(), // client-generated UUID
    expenseId: text('expense_id')
      .notNull()
      .references(() => expenses.id),
    crewMemberId: text('crew_member_id').references(() => crewMembers.id),
    position: integer('position').notNull(),
    workerName: text('worker_name').notNull(),
    role: text('role'),
    minutes: integer('minutes').notNull(),
    rateCents: integer('rate_cents').notNull(), // per hour
    amountCents: integer('amount_cents').notNull(), // earned: round(minutes × rate / 60)
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('expense_labour_lines_expense_id_idx').on(t.expenseId),
    index('expense_labour_lines_crew_member_id_idx').on(t.crewMemberId),
    check('expense_labour_lines_role_length', sql`${t.role} IS NULL OR length(${t.role}) <= ${sql.raw(String(MAX_CREW_ROLE))}`),
    check('expense_labour_lines_minutes_range', sql`${t.minutes} > 0 AND ${t.minutes} <= ${sql.raw(String(MAX_LABOUR_MINUTES))}`),
    check('expense_labour_lines_rate_range', sql`${t.rateCents} > 0 AND ${t.rateCents} <= ${sql.raw(String(MAX_AMOUNT_CENTS))}`),
    check('expense_labour_lines_amount_range', sql`${t.amountCents} >= 0 AND ${t.amountCents} <= ${sql.raw(String(MAX_AMOUNT_CENTS))}`),
    check('expense_labour_lines_name_length', sql`length(${t.workerName}) BETWEEN 1 AND ${sql.raw(String(MAX_WORKER_NAME))}`),
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

// ---------------------------------------------------------------------------
// Quotes & invoices (Phase 1). New tables, introduced by harmony-ops.
//
// Same rules as the finance tables: integer cents, rates in basis points,
// stable snake_case enum keys, and no foreign key into the shared
// `bookings` table (`event_id` is checked by the app). A quote or invoice
// keeps its own snapshot of the customer and event, so later edits to a
// booking never rewrite a document that was already sent.
//
// Totals are stored for listing and reporting but are always recalculated
// on the server by src/lib/quoteCalculator.ts; the CHECKs below make the
// stored figures add up, so they can't drift from each other.
//
// The shared database only accepts new tables (see migrationGuard), so the
// columns later phases need — sent/accepted timestamps, invoice payment
// fields, soft delete — exist from the start.
// ---------------------------------------------------------------------------

const centsRange = (column: unknown) => sql`${column} >= 0 AND ${column} <= ${sql.raw(String(MAX_AMOUNT_CENTS))}`;
const isoDate = (column: unknown) => sql`${column} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`;

// Discount and deposit: `percent` values are basis points, `fixed` values
// cents, `none` always 0.
const adjustmentValid = (type: unknown, value: unknown) =>
  sql`(${type} = 'none' AND ${value} = 0) OR (${type} = 'percent' AND ${value} >= 0 AND ${value} <= ${sql.raw(String(MAX_PERCENT_BP))}) OR (${type} = 'fixed' AND ${centsRange(value)})`;

// Hands out quote and invoice numbers. Incremented with a single atomic
// UPSERT inside the same transaction as the insert that uses the number, so
// two partners saving at once can never be given the same one (and the
// UNIQUE index on the number column is a second line of defense).
export const documentSequences = sqliteTable(
  'document_sequences',
  {
    name: text('name', { enum: DOCUMENT_SEQUENCES }).primaryKey(),
    lastValue: integer('last_value').notNull(),
  },
  (t) => [check('document_sequences_name_valid', sql`${t.name} IN (${inList(DOCUMENT_SEQUENCES)})`), check('document_sequences_value_positive', sql`${t.lastValue} >= 0`)],
);

export const quotes = sqliteTable(
  'quotes',
  {
    // Client-generated UUID, so a retried save can't create a second quote.
    id: text('id').primaryKey(),
    quoteNumber: text('quote_number').notNull(), // Q-000000001, server-assigned
    status: text('status', { enum: QUOTE_STATUSES }).notNull().default('draft'),

    // Customer snapshot.
    customerName: text('customer_name').notNull(),
    customerCompany: text('customer_company'),
    customerEmail: text('customer_email'),
    customerPhone: text('customer_phone'),
    billingAddress: text('billing_address'),

    // Optional link to a booking, plus a snapshot of its details.
    eventId: integer('event_id'),
    eventName: text('event_name'),
    eventDate: text('event_date'), // YYYY-MM-DD; null = TBC
    venueName: text('venue_name'),
    venueAddress: text('venue_address'),

    quoteDate: text('quote_date').notNull(), // YYYY-MM-DD
    validUntil: text('valid_until').notNull(), // YYYY-MM-DD

    currency: text('currency').notNull().default(CURRENCY),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountType: text('discount_type', { enum: ADJUSTMENT_TYPES }).notNull().default('none'),
    discountValue: integer('discount_value').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    // The rate and label the quote was priced with, so a later change to the
    // default rate never rewrites an existing quote.
    taxLabel: text('tax_label').notNull().default('HST'),
    taxRateBp: integer('tax_rate_bp').notNull(),
    taxCents: integer('tax_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    depositType: text('deposit_type', { enum: ADJUSTMENT_TYPES }).notNull().default('none'),
    depositValue: integer('deposit_value').notNull().default(0),
    depositRequiredCents: integer('deposit_required_cents').notNull().default(0),

    notes: text('notes'),
    terms: text('terms'),
    // Whether the PDF prints the payment section (methods, e-transfer, card).
    // Added in migration 0007.
    showPaymentDetails: integer('show_payment_details', { mode: 'boolean' }).notNull().default(true),
    // How the client will pay; null = not chosen (all methods listed). Cash
    // means no HST. Added in migration 0010 — checked by the app (a CHECK
    // can't be added to an existing table on the shared database).
    paymentMethod: text('payment_method', { enum: QUOTE_PAYMENT_METHODS }),
    // Regular or contract client — chose the default terms; `terms` above is
    // the snapshot actually saved. Internal only. Added in migration 0012,
    // checked by the app (same CHECK limitation as payment_method).
    clientType: text('client_type', { enum: QUOTE_CLIENT_TYPES }).notNull().default('regular'),

    // Lifecycle timestamps (ISO). Set by status changes; Phase 3's client
    // link records the acceptance details in its own table.
    statusChangedAt: text('status_changed_at'),
    sentAt: text('sent_at'),
    acceptedAt: text('accepted_at'),

    createdByUserId: text('created_by_user_id').notNull(),
    createdByEmail: text('created_by_email').notNull(),
    updatedByEmail: text('updated_by_email').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(), // also the optimistic-lock version
    deletedAt: text('deleted_at'),
    deletedByEmail: text('deleted_by_email'),
  },
  (t) => [
    uniqueIndex('quotes_quote_number_unique').on(t.quoteNumber),
    index('quotes_event_id_idx').on(t.eventId),
    index('quotes_status_idx').on(t.status),
    check('quotes_status_valid', sql`${t.status} IN (${inList(QUOTE_STATUSES)})`),
    check('quotes_number_format', sql`${t.quoteNumber} GLOB 'Q-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*'`),
    check('quotes_quote_date_format', isoDate(t.quoteDate)),
    check('quotes_valid_until_format', isoDate(t.validUntil)),
    check('quotes_valid_until_after_quote_date', sql`${t.validUntil} >= ${t.quoteDate}`),
    check('quotes_event_date_format', sql`${t.eventDate} IS NULL OR ${isoDate(t.eventDate)}`),
    check('quotes_subtotal_range', centsRange(t.subtotalCents)),
    check('quotes_discount_valid', adjustmentValid(t.discountType, t.discountValue)),
    check('quotes_discount_within_subtotal', sql`${t.discountCents} >= 0 AND ${t.discountCents} <= ${t.subtotalCents}`),
    check('quotes_tax_rate_range', sql`${t.taxRateBp} >= 0 AND ${t.taxRateBp} <= ${sql.raw(String(MAX_HST_RATE_BP))}`),
    check('quotes_tax_non_negative', sql`${t.taxCents} >= 0`),
    check('quotes_total_adds_up', sql`${t.totalCents} = ${t.subtotalCents} - ${t.discountCents} + ${t.taxCents}`),
    check('quotes_deposit_valid', adjustmentValid(t.depositType, t.depositValue)),
    check('quotes_deposit_within_total', sql`${t.depositRequiredCents} >= 0 AND ${t.depositRequiredCents} <= ${t.totalCents}`),
  ],
);

// Line items, in display order. `section` is free text ("LED Display",
// "Sound", or anything typed); consecutive items with the same section are
// shown under one heading.
export const quoteItems = sqliteTable(
  'quote_items',
  {
    id: text('id').primaryKey(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    section: text('section').notNull(),
    itemName: text('item_name').notNull(),
    description: text('description'),
    quantity: integer('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(), // quantity × unit price, before the item's discount
    // Optional discount on this line only (added in migration 0006). What the
    // line contributes to the subtotal is line_total_cents - discount_cents.
    discountType: text('discount_type', { enum: ADJUSTMENT_TYPES }).notNull().default('none'),
    discountValue: integer('discount_value').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('quote_items_quote_order_unique').on(t.quoteId, t.sortOrder),
    check('quote_items_quantity_range', sql`${t.quantity} >= 1 AND ${t.quantity} <= ${sql.raw(String(MAX_ITEM_QUANTITY))}`),
    check('quote_items_unit_price_range', centsRange(t.unitPriceCents)),
    check('quote_items_line_total', sql`${t.lineTotalCents} = ${t.quantity} * ${t.unitPriceCents}`),
    check('quote_items_discount_type_valid', sql`${t.discountType} IN (${inList(ADJUSTMENT_TYPES)})`),
    check('quote_items_discount_valid', adjustmentValid(t.discountType, t.discountValue)),
    check('quote_items_discount_within_line', sql`${t.discountCents} >= 0 AND ${t.discountCents} <= ${t.lineTotalCents}`),
  ],
);

// Invoices copy everything they need from the accepted quote (Phase 4)
// rather than reading it, so the quote can't change an issued invoice.
// `quote_id` is kept for traceability only; an invoice may also stand alone.
export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    invoiceNumber: text('invoice_number').notNull(), // INV-000000001, server-assigned
    quoteId: text('quote_id').references(() => quotes.id),
    status: text('status', { enum: INVOICE_STATUSES }).notNull().default('draft'),

    customerName: text('customer_name').notNull(),
    customerCompany: text('customer_company'),
    customerEmail: text('customer_email'),
    customerPhone: text('customer_phone'),
    billingAddress: text('billing_address'),

    eventId: integer('event_id'),
    eventName: text('event_name'),
    eventDate: text('event_date'),
    venueName: text('venue_name'),
    venueAddress: text('venue_address'),

    invoiceDate: text('invoice_date').notNull(),
    dueDate: text('due_date').notNull(),

    currency: text('currency').notNull().default(CURRENCY),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountType: text('discount_type', { enum: ADJUSTMENT_TYPES }).notNull().default('none'),
    discountValue: integer('discount_value').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    taxLabel: text('tax_label').notNull().default('HST'),
    taxRateBp: integer('tax_rate_bp').notNull(),
    taxCents: integer('tax_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    // Payment position. Phase 5 records the individual payments in their own
    // table and keeps these in step inside the same transaction.
    depositPaidCents: integer('deposit_paid_cents').notNull().default(0),
    amountPaidCents: integer('amount_paid_cents').notNull().default(0), // paid beyond the deposit
    balanceDueCents: integer('balance_due_cents').notNull(),

    notes: text('notes'),
    terms: text('terms'),
    showPaymentDetails: integer('show_payment_details', { mode: 'boolean' }).notNull().default(true), // migration 0007

    statusChangedAt: text('status_changed_at'),
    sentAt: text('sent_at'),
    paidAt: text('paid_at'),
    voidedAt: text('voided_at'),
    voidReason: text('void_reason'),

    createdByUserId: text('created_by_user_id').notNull(),
    createdByEmail: text('created_by_email').notNull(),
    updatedByEmail: text('updated_by_email').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
    deletedByEmail: text('deleted_by_email'),
  },
  (t) => [
    uniqueIndex('invoices_invoice_number_unique').on(t.invoiceNumber),
    index('invoices_quote_id_idx').on(t.quoteId),
    index('invoices_event_id_idx').on(t.eventId),
    index('invoices_status_idx').on(t.status),
    check('invoices_status_valid', sql`${t.status} IN (${inList(INVOICE_STATUSES)})`),
    check('invoices_number_format', sql`${t.invoiceNumber} GLOB 'INV-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*'`),
    check('invoices_invoice_date_format', isoDate(t.invoiceDate)),
    check('invoices_due_date_format', isoDate(t.dueDate)),
    check('invoices_due_after_invoice_date', sql`${t.dueDate} >= ${t.invoiceDate}`),
    check('invoices_event_date_format', sql`${t.eventDate} IS NULL OR ${isoDate(t.eventDate)}`),
    check('invoices_subtotal_range', centsRange(t.subtotalCents)),
    check('invoices_discount_valid', adjustmentValid(t.discountType, t.discountValue)),
    check('invoices_discount_within_subtotal', sql`${t.discountCents} >= 0 AND ${t.discountCents} <= ${t.subtotalCents}`),
    check('invoices_tax_rate_range', sql`${t.taxRateBp} >= 0 AND ${t.taxRateBp} <= ${sql.raw(String(MAX_HST_RATE_BP))}`),
    check('invoices_tax_non_negative', sql`${t.taxCents} >= 0`),
    check('invoices_total_adds_up', sql`${t.totalCents} = ${t.subtotalCents} - ${t.discountCents} + ${t.taxCents}`),
    check('invoices_payments_non_negative', sql`${t.depositPaidCents} >= 0 AND ${t.amountPaidCents} >= 0`),
    check('invoices_balance_adds_up', sql`${t.balanceDueCents} = ${t.totalCents} - ${t.depositPaidCents} - ${t.amountPaidCents}`),
    check('invoices_void_complete', sql`${t.voidedAt} IS NULL OR ${t.voidReason} IS NOT NULL`),
  ],
);

export const invoiceItems = sqliteTable(
  'invoice_items',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    section: text('section').notNull(),
    itemName: text('item_name').notNull(),
    description: text('description'),
    quantity: integer('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(), // quantity × unit price, before the item's discount
    // Optional discount on this line only (added in migration 0006). What the
    // line contributes to the subtotal is line_total_cents - discount_cents.
    discountType: text('discount_type', { enum: ADJUSTMENT_TYPES }).notNull().default('none'),
    discountValue: integer('discount_value').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('invoice_items_invoice_order_unique').on(t.invoiceId, t.sortOrder),
    check('invoice_items_quantity_range', sql`${t.quantity} >= 1 AND ${t.quantity} <= ${sql.raw(String(MAX_ITEM_QUANTITY))}`),
    check('invoice_items_unit_price_range', centsRange(t.unitPriceCents)),
    check('invoice_items_line_total', sql`${t.lineTotalCents} = ${t.quantity} * ${t.unitPriceCents}`),
    check('invoice_items_discount_type_valid', sql`${t.discountType} IN (${inList(ADJUSTMENT_TYPES)})`),
    check('invoice_items_discount_valid', adjustmentValid(t.discountType, t.discountValue)),
    check('invoice_items_discount_within_line', sql`${t.discountCents} >= 0 AND ${t.discountCents} <= ${t.lineTotalCents}`),
  ],
);

// Append-only history of quote and invoice changes, like finance_audit_log
// (whose entity-type CHECK can't be widened on this shared database).
export const salesAuditLog = sqliteTable(
  'sales_audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entityType: text('entity_type', { enum: SALES_AUDIT_ENTITY_TYPES }).notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action', { enum: SALES_AUDIT_ACTIONS }).notNull(),
    changedByUserId: text('changed_by_user_id').notNull(),
    changedByEmail: text('changed_by_email').notNull(),
    changedAt: text('changed_at').notNull(),
    before: text('before'), // JSON snapshot (with line items); null on create
    after: text('after'),
  },
  (t) => [
    index('sales_audit_log_entity_idx').on(t.entityType, t.entityId),
    check('sales_audit_log_entity_type_valid', sql`${t.entityType} IN (${inList(SALES_AUDIT_ENTITY_TYPES)})`),
    check('sales_audit_log_action_valid', sql`${t.action} IN (${inList(SALES_AUDIT_ACTIONS)})`),
  ],
);

// ---------------------------------------------------------------------------
// Client quote links and responses (Phase 3). New tables.
// ---------------------------------------------------------------------------

// A secret link that lets a client open one quote (/q/<token>). Only a hash
// of the token is used to find it; the token itself is kept encrypted so
// staff can copy the link again (src/lib/sales/clientLinkToken.ts). At most
// one link per quote is live at a time — creating a new one revokes the old.
export const quoteAccessLinks = sqliteTable(
  'quote_access_links',
  {
    id: text('id').primaryKey(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    tokenHash: text('token_hash').notNull(),
    tokenEncrypted: text('token_encrypted'),
    // Optional hard cut-off for the link itself (null = until revoked).
    // Whether the quote can still be accepted always follows the quote's
    // current valid-until date, not this.
    expiresAt: text('expires_at'),
    revokedAt: text('revoked_at'),
    revokedByEmail: text('revoked_by_email'),
    lastViewedAt: text('last_viewed_at'),
    viewCount: integer('view_count').notNull().default(0),
    createdByUserId: text('created_by_user_id').notNull(),
    createdByEmail: text('created_by_email').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('quote_access_links_token_hash_unique').on(t.tokenHash),
    index('quote_access_links_quote_id_idx').on(t.quoteId),
    check('quote_access_links_hash_format', sql`length(${t.tokenHash}) = 64`),
    check('quote_access_links_view_count', sql`${t.viewCount} >= 0`),
  ],
);

// The client's answer through a link: an acceptance (name, terms, signature)
// or a decline (optional reason). Kept forever, with what was accepted
// (the quote's total and version at that moment) and the request's IP and
// browser for the record. The database insists an acceptance is complete.
export const quoteAcceptances = sqliteTable(
  'quote_acceptances',
  {
    id: text('id').primaryKey(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    accessLinkId: text('access_link_id').references(() => quoteAccessLinks.id),
    action: text('action', { enum: QUOTE_RESPONSE_ACTIONS }).notNull(),
    customerName: text('customer_name'),
    customerTitle: text('customer_title'),
    signatureType: text('signature_type', { enum: SIGNATURE_TYPES }),
    signatureData: text('signature_data'), // typed: the name; drawn: a PNG data URL
    acceptedTerms: integer('accepted_terms', { mode: 'boolean' }).notNull().default(false),
    declineReason: text('decline_reason'),
    quoteTotalCents: integer('quote_total_cents').notNull(),
    quoteVersion: text('quote_version').notNull(), // the quote's updatedAt the client saw
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('quote_acceptances_quote_id_idx').on(t.quoteId),
    check('quote_acceptances_action_valid', sql`${t.action} IN (${inList(QUOTE_RESPONSE_ACTIONS)})`),
    check('quote_acceptances_signature_type_valid', sql`${t.signatureType} IS NULL OR ${t.signatureType} IN (${inList(SIGNATURE_TYPES)})`),
    check(
      'quote_acceptances_acceptance_complete',
      sql`${t.action} <> 'accepted' OR (${t.customerName} IS NOT NULL AND ${t.signatureType} IS NOT NULL AND ${t.signatureData} IS NOT NULL AND ${t.acceptedTerms} = 1)`,
    ),
    check('quote_acceptances_signature_size', sql`${t.signatureData} IS NULL OR length(${t.signatureData}) <= ${sql.raw(String(MAX_SIGNATURE_DATA_LENGTH))}`),
  ],
);

// What happened around client links: created, revoked, viewed, accepted,
// declined — by staff or the client. Never holds a token.
export const quoteActivity = sqliteTable(
  'quote_activity',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    event: text('event', { enum: QUOTE_ACTIVITY_EVENTS }).notNull(),
    actorType: text('actor_type', { enum: ACTIVITY_ACTORS }).notNull(),
    actorEmail: text('actor_email'), // staff only
    accessLinkId: text('access_link_id'),
    metadata: text('metadata'), // JSON
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('quote_activity_quote_id_idx').on(t.quoteId),
    check('quote_activity_event_valid', sql`${t.event} IN (${inList(QUOTE_ACTIVITY_EVENTS)})`),
    check('quote_activity_actor_valid', sql`${t.actorType} IN (${inList(ACTIVITY_ACTORS)})`),
  ],
);

// Every quote email the provider accepted: who it went to, when, who sent
// it, and whether it was the quote's first email or a resend. Failed sends
// are never recorded. Holds no link token and no PDF (its own table because
// quote_activity's event CHECK can't be widened on the shared database).
export const quoteEmailSends = sqliteTable(
  'quote_email_sends',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    recipientEmail: text('recipient_email').notNull(),
    kind: text('kind', { enum: QUOTE_EMAIL_SEND_KINDS }).notNull(),
    sentByEmail: text('sent_by_email').notNull(), // staff
    providerMessageId: text('provider_message_id'), // Resend's id, for tracing a delivery
    sentAt: text('sent_at').notNull(),
  },
  (t) => [
    index('quote_email_sends_quote_id_idx').on(t.quoteId),
    check('quote_email_sends_kind_valid', sql`${t.kind} IN (${inList(QUOTE_EMAIL_SEND_KINDS)})`),
  ],
);

// The price list the quote builder picks items from. New table. Picking an
// item copies its name, description and price into the quote line, so
// editing or deleting an item here never changes a saved quote.
export const inventoryItems = sqliteTable(
  'inventory_items',
  {
    id: text('id').primaryKey(),
    section: text('section').notNull(), // the quote section it goes under, e.g. "LED Display"
    itemName: text('item_name').notNull(),
    description: text('description'),
    unitPriceCents: integer('unit_price_cents').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(), // also the optimistic-lock version
    updatedByEmail: text('updated_by_email').notNull(),
  },
  (t) => [
    index('inventory_items_section_idx').on(t.section),
    check('inventory_items_unit_price_range', centsRange(t.unitPriceCents)),
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
export type ExpenseLabourLineRow = typeof expenseLabourLines.$inferSelect;
export type CrewMemberRow = typeof crewMembers.$inferSelect;
export type QuoteRow = typeof quotes.$inferSelect;
export type QuoteItemRow = typeof quoteItems.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;
export type InvoiceItemRow = typeof invoiceItems.$inferSelect;
export type QuoteAccessLinkRow = typeof quoteAccessLinks.$inferSelect;
export type QuoteAcceptanceRow = typeof quoteAcceptances.$inferSelect;
export type QuoteEmailSendRow = typeof quoteEmailSends.$inferSelect;
export type InventoryItemRow = typeof inventoryItems.$inferSelect;
