CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`section` text NOT NULL,
	`item_name` text NOT NULL,
	`description` text,
	`unit_price_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by_email` text NOT NULL,
	CONSTRAINT "inventory_items_unit_price_range" CHECK("inventory_items"."unit_price_cents" >= 0 AND "inventory_items"."unit_price_cents" <= 100000000)
);
--> statement-breakpoint
CREATE INDEX `inventory_items_section_idx` ON `inventory_items` (`section`);