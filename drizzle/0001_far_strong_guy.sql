CREATE TABLE `pricing_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`led_price_per_sqft` real DEFAULT 17 NOT NULL,
	`stage_price_per_panel` real DEFAULT 85 NOT NULL,
	`updated_at` text
);
