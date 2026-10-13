ALTER TABLE `invoices` ADD `show_payment_details` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `quotes` ADD `show_payment_details` integer DEFAULT true NOT NULL;