-- Device sighting history + lightweight behavior score config.
CREATE TABLE `riskDeviceSighting` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`deviceId` text NOT NULL,
	`clientIp` text,
	`firstSeenAt` integer NOT NULL,
	`lastSeenAt` integer NOT NULL,
	`sightingCount` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `riskDeviceSighting_user_device_uidx` ON `riskDeviceSighting` (`userId`,`deviceId`);--> statement-breakpoint
CREATE INDEX `riskDeviceSighting_device_idx` ON `riskDeviceSighting` (`deviceId`);--> statement-breakpoint
CREATE INDEX `riskDeviceSighting_user_idx` ON `riskDeviceSighting` (`userId`);--> statement-breakpoint
CREATE TABLE `riskUserScore` (
	`userId` text PRIMARY KEY NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`reasonsJson` text,
	`updatedAt` integer NOT NULL
);--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `behaviorWindowHours` integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `maxDevicesPerUser` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `maxIpsPerUser` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `behaviorScoreReview` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `behaviorScoreBlock` integer DEFAULT 80 NOT NULL;
