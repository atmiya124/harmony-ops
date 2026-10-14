CREATE TABLE `quote_email_sends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`kind` text NOT NULL,
	`sent_by_email` text NOT NULL,
	`provider_message_id` text,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quote_email_sends_kind_valid" CHECK("quote_email_sends"."kind" IN ('first', 'resend'))
);
--> statement-breakpoint
CREATE INDEX `quote_email_sends_quote_id_idx` ON `quote_email_sends` (`quote_id`);