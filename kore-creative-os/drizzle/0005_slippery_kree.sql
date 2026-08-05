CREATE TABLE `calendar_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`client_id` text,
	`property_id` text,
	`title` text NOT NULL,
	`content_type` text DEFAULT 'post' NOT NULL,
	`channel` text DEFAULT 'Instagram' NOT NULL,
	`scheduled_for` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `calendar_items_owner_date_idx` ON `calendar_items` (`owner`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `calendar_items_client_idx` ON `calendar_items` (`client_id`);--> statement-breakpoint
CREATE INDEX `calendar_items_property_idx` ON `calendar_items` (`property_id`);--> statement-breakpoint
CREATE TABLE `camera_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`horizontal` real DEFAULT 0 NOT NULL,
	`vertical` real DEFAULT 0 NOT NULL,
	`zoom` real DEFAULT 0 NOT NULL,
	`pan` real DEFAULT 0 NOT NULL,
	`tilt` real DEFAULT 0 NOT NULL,
	`rotate` real DEFAULT 0 NOT NULL,
	`duration_seconds` real DEFAULT 5 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `camera_presets_owner_name_idx` ON `camera_presets` (`owner`,`name`);--> statement-breakpoint
CREATE INDEX `camera_presets_owner_created_idx` ON `camera_presets` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#2563eb' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_owner_name_idx` ON `clients` (`owner`,`name`);--> statement-breakpoint
CREATE INDEX `clients_owner_created_idx` ON `clients` (`owner`,`created_at`);