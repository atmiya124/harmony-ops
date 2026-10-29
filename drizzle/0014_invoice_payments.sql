CREATE TABLE `invoice_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text,
	`received_on` text NOT NULL,
	`reference` text,
	`recorded_by_user_id` text NOT NULL,
	`recorded_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	`voided_at` text,
	`voided_by_email` text,
	`void_reason` text,
	`receipt_sent_at` text,
	`receipt_sent_to` text,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invoice_payments_kind_valid" CHECK("invoice_payments"."kind" IN ('deposit', 'payment')),
	CONSTRAINT "invoice_payments_amount_range" CHECK("invoice_payments"."amount_cents" > 0 AND "invoice_payments"."amount_cents" <= 100000000),
	CONSTRAINT "invoice_payments_received_on_format" CHECK("invoice_payments"."received_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "invoice_payments_reference_length" CHECK("invoice_payments"."reference" IS NULL OR length("invoice_payments"."reference") <= 200),
	CONSTRAINT "invoice_payments_void_complete" CHECK(("invoice_payments"."voided_at" IS NULL) = ("invoice_payments"."voided_by_email" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `invoice_payments_invoice_id_idx` ON `invoice_payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `invoice_payments_received_on_idx` ON `invoice_payments` (`received_on`);