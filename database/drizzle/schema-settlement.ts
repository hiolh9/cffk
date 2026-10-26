import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** BNM (or manual) monthly average: 1 unit of currency → MYR */
export const fxMonthlyRate = sqliteTable(
  "fxMonthlyRate",
  {
    yearMonth: text("yearMonth").notNull(),
    currency: text("currency").notNull(),
    rateToMyr: real("rateToMyr").notNull(),
    source: text("source").notNull().default("BNM"),
    fetchedAt: integer("fetchedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.yearMonth, table.currency] })],
);

/** Accounting sale line — revenue locked on transaction date */
export const acctSale = sqliteTable(
  "acctSale",
  {
    orderId: text("orderId").primaryKey(),
    sourceOrderPk: integer("sourceOrderPk"),
    transactionDate: integer("transactionDate", { mode: "timestamp_ms" }).notNull(),
    customerId: text("customerId"),
    productDesc: text("productDesc").notNull(),
    originalCurrency: text("originalCurrency").notNull(),
    originalAmount: real("originalAmount").notNull(),
    transactionFxRate: real("transactionFxRate").notNull(),
    revenueMyr: real("revenueMyr").notNull(),
    cogsMyr: real("cogsMyr").notNull().default(0),
    status: text("status", { enum: ["Success", "Refunded", "Voided"] })
      .notNull()
      .default("Success"),
    gatewayProvider: text("gatewayProvider"),
    gatewayRef: text("gatewayRef"),
    refundedAt: integer("refundedAt", { mode: "timestamp_ms" }),
    refundMyr: real("refundMyr").default(0),
    refundNote: text("refundNote"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("acctSale_transactionDate_idx").on(table.transactionDate),
    index("acctSale_status_transactionDate_idx").on(table.status, table.transactionDate),
    index("acctSale_sourceOrderPk_idx").on(table.sourceOrderPk),
  ],
);

export const acctSettlement = sqliteTable(
  "acctSettlement",
  {
    settlementId: text("settlementId").primaryKey(),
    settlementDate: integer("settlementDate", { mode: "timestamp_ms" }).notNull(),
    grossOrdersMyrTotal: real("grossOrdersMyrTotal").notNull().default(0),
    gatewayFeeMyr: real("gatewayFeeMyr").notNull().default(0),
    bankReceivedMyr: real("bankReceivedMyr").notNull(),
    realisedFxGainLoss: real("realisedFxGainLoss").notNull().default(0),
    notes: text("notes"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("acctSettlement_settlementDate_idx").on(table.settlementDate)],
);

export const acctSettlementOrder = sqliteTable(
  "acctSettlementOrder",
  {
    settlementId: text("settlementId")
      .notNull()
      .references(() => acctSettlement.settlementId, { onDelete: "cascade" }),
    orderId: text("orderId")
      .notNull()
      .references(() => acctSale.orderId, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.settlementId, table.orderId] }),
    uniqueIndex("acctSettlementOrder_order_once").on(table.orderId),
    index("acctSettlementOrder_settlementId_idx").on(table.settlementId),
  ],
);

/** Post-settlement refund / void / FX correction lines */
export const acctAdjustment = sqliteTable(
  "acctAdjustment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("orderId").notNull(),
    settlementId: text("settlementId"),
    type: text("type", { enum: ["REFUND", "VOID", "FX_CORRECTION"] }).notNull(),
    revenueReversalMyr: real("revenueReversalMyr").notNull().default(0),
    bankImpactMyr: real("bankImpactMyr").notNull().default(0),
    note: text("note"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    createdBy: text("createdBy"),
  },
  (table) => [
    index("acctAdjustment_orderId_idx").on(table.orderId),
    index("acctAdjustment_settlementId_idx").on(table.settlementId),
    index("acctAdjustment_createdAt_idx").on(table.createdAt),
  ],
);

/** Non-order cash movements (drawings, expenses, prepayments, etc.) */
export const acctGeneralLedger = sqliteTable(
  "acctGeneralLedger",
  {
    entryId: text("entryId").primaryKey(),
    entryDate: integer("entryDate", { mode: "timestamp_ms" }).notNull(),
    type: text("type", {
      enum: ["Owner_Drawing", "Capital_Injection", "Expense", "Prepayment", "Asset_Transfer"],
    }).notNull(),
    description: text("description").notNull(),
    /** Positive = inflow, negative = outflow */
    amountMyr: real("amountMyr").notNull(),
    isTaxDeductible: integer("isTaxDeductible", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    createdBy: text("createdBy"),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("acctGeneralLedger_entryDate_idx").on(table.entryDate),
    index("acctGeneralLedger_type_entryDate_idx").on(table.type, table.entryDate),
  ],
);

/** Saved monthly P&L runs */
export const acctPnLSnapshot = sqliteTable("acctPnLSnapshot", {
  yearMonth: text("yearMonth").primaryKey(),
  salesRevenueMyr: real("salesRevenueMyr").notNull().default(0),
  cogsMyr: real("cogsMyr").notNull().default(0),
  grossProfitMyr: real("grossProfitMyr").notNull().default(0),
  gatewayFeesMyr: real("gatewayFeesMyr").notNull().default(0),
  operatingExpensesMyr: real("operatingExpensesMyr").notNull().default(0),
  realisedFxGainLossMyr: real("realisedFxGainLossMyr").notNull().default(0),
  netProfitMyr: real("netProfitMyr").notNull().default(0),
  detailJson: text("detailJson"),
  generatedAt: integer("generatedAt", { mode: "timestamp_ms" }).notNull(),
});
