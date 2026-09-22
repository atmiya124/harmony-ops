import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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
