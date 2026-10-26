import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  (table) => [index("fxMonthlyRate_pk_proxy").on(table.yearMonth, table.currency)],
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
    uniqueIndex("acctSettlementOrder_order_once").on(table.orderId),
    index("acctSettlementOrder_settlementId_idx").on(table.settlementId),
  ],
);
