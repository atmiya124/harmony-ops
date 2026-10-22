CREATE TABLE `crew_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`role` text,
	`company` text,
	`default_rate_cents` integer,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_by_email` text NOT NULL,
	`updated_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "crew_members_name_length" CHECK(length("crew_members"."name") BETWEEN 1 AND 80),
	CONSTRAINT "crew_members_rate_range" CHECK("crew_members"."default_rate_cents" IS NULL OR ("crew_members"."default_rate_cents" > 0 AND "crew_members"."default_rate_cents" <= 100000000))
);
--> statement-breakpoint
CREATE INDEX `crew_members_name_idx` ON `crew_members` (`name`);--> statement-breakpoint
CREATE TABLE `expense_labour_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`crew_member_id` text,
	`position` integer NOT NULL,
	`worker_name` text NOT NULL,
	`role` text,
	`minutes` integer NOT NULL,
	`rate_cents` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`crew_member_id`) REFERENCES `crew_members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "expense_labour_lines_role_length" CHECK("expense_labour_lines"."role" IS NULL OR length("expense_labour_lines"."role") <= 60),
	CONSTRAINT "expense_labour_lines_minutes_range" CHECK("expense_labour_lines"."minutes" > 0 AND "expense_labour_lines"."minutes" <= 1440),
	CONSTRAINT "expense_labour_lines_rate_range" CHECK("expense_labour_lines"."rate_cents" > 0 AND "expense_labour_lines"."rate_cents" <= 100000000),
	CONSTRAINT "expense_labour_lines_amount_range" CHECK("expense_labour_lines"."amount_cents" >= 0 AND "expense_labour_lines"."amount_cents" <= 100000000),
	CONSTRAINT "expense_labour_lines_name_length" CHECK(length("expense_labour_lines"."worker_name") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE INDEX `expense_labour_lines_expense_id_idx` ON `expense_labour_lines` (`expense_id`);--> statement-breakpoint
CREATE INDEX `expense_labour_lines_crew_member_id_idx` ON `expense_labour_lines` (`crew_member_id`);--> statement-breakpoint
ALTER TABLE `expenses` ADD `kind` text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `labour_line_id` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `reference` text;