CREATE TABLE `quote_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`access_link_id` text,
	`action` text NOT NULL,
	`customer_name` text,
	`customer_title` text,
	`signature_type` text,
	`signature_data` text,
	`accepted_terms` integer DEFAULT false NOT NULL,
	`decline_reason` text,
	`quote_total_cents` integer NOT NULL,
	`quote_version` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`access_link_id`) REFERENCES `quote_access_links`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quote_acceptances_action_valid" CHECK("quote_acceptances"."action" IN ('accepted', 'declined')),
	CONSTRAINT "quote_acceptances_signature_type_valid" CHECK("quote_acceptances"."signature_type" IS NULL OR "quote_acceptances"."signature_type" IN ('typed', 'drawn')),
	CONSTRAINT "quote_acceptances_acceptance_complete" CHECK("quote_acceptances"."action" <> 'accepted' OR ("quote_acceptances"."customer_name" IS NOT NULL AND "quote_acceptances"."signature_type" IS NOT NULL AND "quote_acceptances"."signature_data" IS NOT NULL AND "quote_acceptances"."accepted_terms" = 1)),
	CONSTRAINT "quote_acceptances_signature_size" CHECK("quote_acceptances"."signature_data" IS NULL OR length("quote_acceptances"."signature_data") <= 200000)
);
--> statement-breakpoint
CREATE INDEX `quote_acceptances_quote_id_idx` ON `quote_acceptances` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quote_access_links` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_encrypted` text,
	`expires_at` text,
	`revoked_at` text,
	`revoked_by_email` text,
	`last_viewed_at` text,
	`view_count` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quote_access_links_hash_format" CHECK(length("quote_access_links"."token_hash") = 64),
	CONSTRAINT "quote_access_links_view_count" CHECK("quote_access_links"."view_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_access_links_token_hash_unique` ON `quote_access_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `quote_access_links_quote_id_idx` ON `quote_access_links` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quote_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_id` text NOT NULL,
	`event` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_email` text,
	`access_link_id` text,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quote_activity_event_valid" CHECK("quote_activity"."event" IN ('client_link_created', 'client_link_revoked', 'quote_viewed', 'quote_accepted', 'quote_declined')),
	CONSTRAINT "quote_activity_actor_valid" CHECK("quote_activity"."actor_type" IN ('staff', 'client'))
);
--> statement-breakpoint
CREATE INDEX `quote_activity_quote_id_idx` ON `quote_activity` (`quote_id`);