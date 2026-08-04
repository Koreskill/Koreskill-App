CREATE TABLE `generated_texts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`property_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`source_text` text,
	`prompt_version` text DEFAULT 'v1' NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_micros` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generated_texts_property_idx` ON `generated_texts` (`property_id`);--> statement-breakpoint
CREATE INDEX `generated_texts_owner_created_idx` ON `generated_texts` (`owner`,`created_at`);