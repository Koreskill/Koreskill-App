CREATE TABLE `image_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`batch_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`prompt` text NOT NULL,
	`quality` text DEFAULT 'low' NOT NULL,
	`aspect_ratio` text DEFAULT '9:16' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`input_key` text NOT NULL,
	`output_key` text,
	`output_mime_type` text,
	`prediction_id` text,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `image_jobs_owner_created_idx` ON `image_jobs` (`owner`,`created_at`);--> statement-breakpoint
CREATE INDEX `image_jobs_batch_idx` ON `image_jobs` (`batch_id`);