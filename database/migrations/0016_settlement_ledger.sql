-- LHDN-oriented multi-currency settlement ledger
-- Revenue locked at transaction-date monthly avg FX; realised FX on settlement date.

CREATE TABLE `fxMonthlyRate` (
  `yearMonth` text NOT NULL,
  `currency` text NOT NULL,
  `rateToMyr` real NOT NULL,
  `source` text NOT NULL DEFAULT 'BNM',
  `fetchedAt` integer NOT NULL,
  PRIMARY KEY (`yearMonth`, `currency`)
);

CREATE TABLE `acctSale` (
  `orderId` text PRIMARY KEY NOT NULL,
  `sourceOrderPk` integer,
  `transactionDate` integer NOT NULL,
  `customerId` text,
  `productDesc` text NOT NULL,
  `originalCurrency` text NOT NULL,
  `originalAmount` real NOT NULL,
  `transactionFxRate` real NOT NULL,
  `revenueMyr` real NOT NULL,
  `cogsMyr` real NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'Success',
  `gatewayProvider` text,
  `gatewayRef` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
CREATE INDEX `acctSale_transactionDate_idx` ON `acctSale` (`transactionDate`);
CREATE INDEX `acctSale_status_transactionDate_idx` ON `acctSale` (`status`, `transactionDate`);
CREATE INDEX `acctSale_sourceOrderPk_idx` ON `acctSale` (`sourceOrderPk`);

CREATE TABLE `acctSettlement` (
  `settlementId` text PRIMARY KEY NOT NULL,
  `settlementDate` integer NOT NULL,
  `grossOrdersMyrTotal` real NOT NULL DEFAULT 0,
  `gatewayFeeMyr` real NOT NULL DEFAULT 0,
  `bankReceivedMyr` real NOT NULL,
  `realisedFxGainLoss` real NOT NULL DEFAULT 0,
  `notes` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
CREATE INDEX `acctSettlement_settlementDate_idx` ON `acctSettlement` (`settlementDate`);

CREATE TABLE `acctSettlementOrder` (
  `settlementId` text NOT NULL,
  `orderId` text NOT NULL,
  PRIMARY KEY (`settlementId`, `orderId`),
  FOREIGN KEY (`settlementId`) REFERENCES `acctSettlement`(`settlementId`) ON DELETE CASCADE,
  FOREIGN KEY (`orderId`) REFERENCES `acctSale`(`orderId`) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX `acctSettlementOrder_order_once` ON `acctSettlementOrder` (`orderId`);
CREATE INDEX `acctSettlementOrder_settlementId_idx` ON `acctSettlementOrder` (`settlementId`);
