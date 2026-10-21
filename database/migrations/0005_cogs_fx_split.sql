-- Dual procurement COGS: local MYR prepaid vs cross-border CNY + FX bridge
ALTER TABLE `order` ADD COLUMN `cogsSource` text;
ALTER TABLE `order` ADD COLUMN `cogsAmountMyrCents` integer DEFAULT 0 NOT NULL;
ALTER TABLE `order` ADD COLUMN `cogsOriginalCurrency` text;
ALTER TABLE `order` ADD COLUMN `cogsOriginalAmountMinor` text;
ALTER TABLE `order` ADD COLUMN `exchangeRateUsed` text;
ALTER TABLE `order` ADD COLUMN `fxDifferenceCents` integer DEFAULT 0 NOT NULL;
CREATE INDEX IF NOT EXISTS `order_cogsSource_idx` ON `order` (`cogsSource`);
