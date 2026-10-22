-- Soft anti-abuse order limits (MYR sen / cents). 0 = unlimited. Defaults: RM500 / RM2000 / 50 orders.
ALTER TABLE `siteSetting` ADD COLUMN `maxOrderAmountCents` integer DEFAULT 50000 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `maxDailyUserAmountCents` integer DEFAULT 200000 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `maxDailyUserOrders` integer DEFAULT 50 NOT NULL;
