-- Operational kill switches for storefront checkout and auto fulfillment (supplier API / local auto delivery).
ALTER TABLE `siteSetting` ADD COLUMN `checkoutEnabled` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `siteSetting` ADD COLUMN `autoFulfillEnabled` integer DEFAULT 1 NOT NULL;
