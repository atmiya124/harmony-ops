CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_provider` text NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`original_filename` text,
	`uploaded_by_user_id` text NOT NULL,
	`uploaded_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "attachments_size_positive" CHECK("attachments"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_storage_key_unique` ON `attachments` (`storage_provider`,`storage_key`);--> statement-breakpoint
CREATE TABLE `event_financials` (
	`booking_id` integer PRIMARY KEY NOT NULL,
	`agreed_amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`amount_status` text NOT NULL,
	`hst_treatment` text NOT NULL,
	`hst_rate_bp` integer NOT NULL,
	`notes` text,
	`created_by_email` text NOT NULL,
	`updated_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "event_financials_amount_range" CHECK("event_financials"."agreed_amount_cents" >= 0 AND "event_financials"."agreed_amount_cents" <= 100000000),
	CONSTRAINT "event_financials_status_valid" CHECK("event_financials"."amount_status" IN ('estimated', 'confirmed')),
	CONSTRAINT "event_financials_hst_treatment_valid" CHECK("event_financials"."hst_treatment" IN ('excluded', 'included', 'exempt')),
	CONSTRAINT "event_financials_hst_rate_range" CHECK("event_financials"."hst_rate_bp" >= 0 AND "event_financials"."hst_rate_bp" <= 3000)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` integer,
	`category` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`expense_date` text NOT NULL,
	`paid_by_email` text NOT NULL,
	`payment_method` text NOT NULL,
	`funding_source` text NOT NULL,
	`reimbursable` integer NOT NULL,
	`receipt_attachment_id` text,
	`notes` text,
	`created_by_user_id` text NOT NULL,
	`created_by_email` text NOT NULL,
	`updated_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`deleted_by_email` text,
	FOREIGN KEY (`receipt_attachment_id`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "expenses_amount_range" CHECK("expenses"."amount_cents" > 0 AND "expenses"."amount_cents" <= 100000000),
	CONSTRAINT "expenses_tax_within_amount" CHECK("expenses"."tax_cents" >= 0 AND "expenses"."tax_cents" < "expenses"."amount_cents"),
	CONSTRAINT "expenses_category_valid" CHECK("expenses"."category" IN ('equipment_rental', 'equipment_purchase', 'transportation_fuel', 'crew', 'food', 'maintenance', 'other')),
	CONSTRAINT "expenses_payment_method_valid" CHECK("expenses"."payment_method" IN ('personal_card', 'company_card', 'cash', 'etransfer')),
	CONSTRAINT "expenses_funding_source_valid" CHECK("expenses"."funding_source" IN ('personal', 'company')),
	CONSTRAINT "expenses_company_not_reimbursable" CHECK("expenses"."funding_source" = 'personal' OR "expenses"."reimbursable" = 0),
	CONSTRAINT "expenses_date_format" CHECK("expenses"."expense_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE INDEX `expenses_booking_id_idx` ON `expenses` (`booking_id`);--> statement-breakpoint
CREATE INDEX `expenses_expense_date_idx` ON `expenses` (`expense_date`);--> statement-breakpoint
CREATE INDEX `expenses_paid_by_email_idx` ON `expenses` (`paid_by_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_receipt_attachment_unique` ON `expenses` (`receipt_attachment_id`);--> statement-breakpoint
CREATE TABLE `finance_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`changed_by_user_id` text NOT NULL,
	`changed_by_email` text NOT NULL,
	`changed_at` text NOT NULL,
	`before` text,
	`after` text,
	CONSTRAINT "finance_audit_log_entity_type_valid" CHECK("finance_audit_log"."entity_type" IN ('expense', 'reimbursement', 'attachment', 'event_financials', 'finance_settings')),
	CONSTRAINT "finance_audit_log_action_valid" CHECK("finance_audit_log"."action" IN ('create', 'update', 'delete', 'restore', 'void'))
);
--> statement-breakpoint
CREATE INDEX `finance_audit_log_entity_idx` ON `finance_audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `finance_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`hst_registered` integer DEFAULT false NOT NULL,
	`default_hst_rate_bp` integer DEFAULT 1300 NOT NULL,
	`updated_by_email` text,
	`updated_at` text,
	CONSTRAINT "finance_settings_singleton" CHECK("finance_settings"."id" = 1),
	CONSTRAINT "finance_settings_hst_rate_range" CHECK("finance_settings"."default_hst_rate_bp" >= 0 AND "finance_settings"."default_hst_rate_bp" <= 3000)
);
--> statement-breakpoint
CREATE TABLE `reimbursements` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`reimbursed_on` text NOT NULL,
	`method` text NOT NULL,
	`notes` text,
	`recorded_by_user_id` text NOT NULL,
	`recorded_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	`voided_at` text,
	`voided_by_email` text,
	`void_reason` text,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reimbursements_amount_range" CHECK("reimbursements"."amount_cents" > 0 AND "reimbursements"."amount_cents" <= 100000000),
	CONSTRAINT "reimbursements_method_valid" CHECK("reimbursements"."method" IN ('etransfer', 'cash', 'cheque', 'bank_transfer')),
	CONSTRAINT "reimbursements_date_format" CHECK("reimbursements"."reimbursed_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "reimbursements_void_complete" CHECK("reimbursements"."voided_at" IS NULL OR ("reimbursements"."voided_by_email" IS NOT NULL AND "reimbursements"."void_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `reimbursements_expense_id_idx` ON `reimbursements` (`expense_id`);