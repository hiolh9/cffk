-- Accounting: invoice sequence, payment fee, method kind, audit trail, monthly archive log
ALTER TABLE `order` ADD COLUMN `invoiceNo` text;
ALTER TABLE `order` ADD COLUMN `paymentFeeCents` integer DEFAULT 0 NOT NULL;
ALTER TABLE `order` ADD COLUMN `paymentMethodKind` text DEFAULT 'GATEWAY' NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS `order_invoiceNo_unique` ON `order` (`invoiceNo`) WHERE `invoiceNo` IS NOT NULL;

CREATE TABLE IF NOT EXISTS `auditLog` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `actorUserId` text,
  `actorEmail` text,
  `action` text NOT NULL,
  `entityType` text NOT NULL,
  `entityId` text NOT NULL,
  `beforeJson` text,
  `afterJson` text,
  `note` text,
  `createdAt` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `auditLog_entity_idx` ON `auditLog` (`entityType`, `entityId`);
CREATE INDEX IF NOT EXISTS `auditLog_createdAt_idx` ON `auditLog` (`createdAt`);

CREATE TABLE IF NOT EXISTS `accountingArchive` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `period` text NOT NULL,
  `rowCount` integer NOT NULL,
  `objectKey` text,
  `status` text NOT NULL DEFAULT 'SUCCESS',
  `errorMessage` text,
  `createdAt` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `accountingArchive_period_unique` ON `accountingArchive` (`period`);

CREATE TABLE IF NOT EXISTS `invoiceSequence` (
  `id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
  `year` integer NOT NULL,
  `nextValue` integer NOT NULL DEFAULT 1
);
