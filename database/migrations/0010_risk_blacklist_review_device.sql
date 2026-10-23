-- Blacklist + large-order review + device multi-user (soft-coded).
CREATE TABLE `riskBlacklist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`reason` text,
	`enabled` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `riskBlacklist_kind_value_uidx` ON `riskBlacklist` (`kind`,`value`);--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `deviceMultiUserMaxUsers` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `deviceMultiUserWindowMinutes` integer DEFAULT 1440 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `reviewOrderAmountCents` integer DEFAULT 30000 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `maxHourlyUserOrders` integer DEFAULT 10 NOT NULL;
