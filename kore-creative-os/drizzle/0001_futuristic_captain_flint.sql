CREATE TABLE `generation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`property_id` text,
	`job_id` text NOT NULL,
	`prediction_id` text NOT NULL,
	`quality` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`estimated_cost_micros` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `image_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_runs_prediction_idx` ON `generation_runs` (`prediction_id`);--> statement-breakpoint
CREATE INDEX `generation_runs_property_idx` ON `generation_runs` (`property_id`);--> statement-breakpoint
CREATE INDEX `generation_runs_job_idx` ON `generation_runs` (`job_id`);--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `properties_owner_created_idx` ON `properties` (`owner`,`created_at`);--> statement-breakpoint
ALTER TABLE `image_jobs` ADD `property_id` text REFERENCES properties(id);--> statement-breakpoint
CREATE INDEX `image_jobs_property_idx` ON `image_jobs` (`property_id`);