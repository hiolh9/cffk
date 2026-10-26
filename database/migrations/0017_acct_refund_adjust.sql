-- Refund / void tracking + settlement adjustments for post-settlement refunds

ALTER TABLE `acctSale` ADD `refundedAt` integer;
ALTER TABLE `acctSale` ADD `refundMyr` real DEFAULT 0;
ALTER TABLE `acctSale` ADD `refundNote` text;

CREATE TABLE `acctAdjustment` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `orderId` text NOT NULL,
  `settlementId` text,
  `type` text NOT NULL,
  `revenueReversalMyr` real NOT NULL DEFAULT 0,
  `bankImpactMyr` real NOT NULL DEFAULT 0,
  `note` text,
  `createdAt` integer NOT NULL,
  `createdBy` text
);
CREATE INDEX `acctAdjustment_orderId_idx` ON `acctAdjustment` (`orderId`);
CREATE INDEX `acctAdjustment_settlementId_idx` ON `acctAdjustment` (`settlementId`);
CREATE INDEX `acctAdjustment_createdAt_idx` ON `acctAdjustment` (`createdAt`);
