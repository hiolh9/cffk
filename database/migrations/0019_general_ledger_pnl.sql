-- General ledger (non-order cash movements) + optional monthly P&L snapshots

CREATE TABLE `acctGeneralLedger` (
  `entryId` text PRIMARY KEY NOT NULL,
  `entryDate` integer NOT NULL,
  `type` text NOT NULL,
  `description` text NOT NULL,
  `amountMyr` real NOT NULL,
  `isTaxDeductible` integer NOT NULL DEFAULT 0,
  `createdAt` integer NOT NULL,
  `createdBy` text,
  `updatedAt` integer NOT NULL
);
CREATE INDEX `acctGeneralLedger_entryDate_idx` ON `acctGeneralLedger` (`entryDate`);
CREATE INDEX `acctGeneralLedger_type_entryDate_idx` ON `acctGeneralLedger` (`type`, `entryDate`);

CREATE TABLE `acctPnLSnapshot` (
  `yearMonth` text PRIMARY KEY NOT NULL,
  `salesRevenueMyr` real NOT NULL DEFAULT 0,
  `cogsMyr` real NOT NULL DEFAULT 0,
  `grossProfitMyr` real NOT NULL DEFAULT 0,
  `gatewayFeesMyr` real NOT NULL DEFAULT 0,
  `operatingExpensesMyr` real NOT NULL DEFAULT 0,
  `realisedFxGainLossMyr` real NOT NULL DEFAULT 0,
  `netProfitMyr` real NOT NULL DEFAULT 0,
  `detailJson` text,
  `generatedAt` integer NOT NULL
);
