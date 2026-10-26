-- Order-level refund tracking (sync with acctSale)

ALTER TABLE `order` ADD `refundedAt` integer;
ALTER TABLE `order` ADD `refundAmountCents` integer NOT NULL DEFAULT 0;
ALTER TABLE `order` ADD `refundReason` text;
