-- Soft-coded risk / anti-abuse limits (editable in admin site settings). 0 = unlimited where noted.
ALTER TABLE `siteSetting` ADD COLUMN `newAccountWindowHours` integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `newAccountMaxOrderCents` integer DEFAULT 10000 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `newAccountMaxOrders` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `ipMultiAccountMaxUsers` integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `ipMultiAccountWindowMinutes` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `orderCreateIpLimit` integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `orderCreateUserLimit` integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `orderCreateDeviceLimit` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `orderCreateWindowMinutes` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `alertPaidOrderBurst` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `alertSupplierFailBurst` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `supplierMaxAttempts` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `stepUpMinutes` integer DEFAULT 10 NOT NULL;
