CREATE TABLE `equipment_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`item_name` text NOT NULL,
	`category` text NOT NULL,
	`pixel_pitch` real,
	`panel_width` real,
	`panel_height` real,
	`power_draw_watts` real,
	`keywords` text DEFAULT '' NOT NULL
);
