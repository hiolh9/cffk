import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const taxType = sqliteTable(
  "tax_type",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    defaultRatePercent: real("defaultRatePercent").notNull().default(0),
    calcBasis: text("calcBasis", {
      enum: ["GROSS_REVENUE", "COGS", "NET_PROFIT", "MANUAL"],
    })
      .notNull()
      .default("GROSS_REVENUE"),
    cycleDays: integer("cycleDays").notNull().default(60),
    dueDaysAfterPeriodEnd: integer("dueDaysAfterPeriodEnd").notNull().default(30),
    reminderDaysBefore: text("reminderDaysBefore").notNull().default("14,7,3,1"),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("tax_type_active_sort_idx").on(t.isActive, t.sort)],
);

export const productTax = sqliteTable(
  "product_tax",
  {
    productId: integer("productId").notNull(),
    taxTypeId: integer("taxTypeId").notNull(),
    ratePercentOverride: real("ratePercentOverride"),
    isRequired: integer("isRequired", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.taxTypeId] }),
    index("product_tax_taxTypeId_idx").on(t.taxTypeId),
  ],
);

export const taxReturnBatch = sqliteTable(
  "tax_return_batch",
  {
    id: text("id").primaryKey(),
    taxTypeId: integer("taxTypeId").notNull(),
    periodFrom: integer("periodFrom", { mode: "timestamp_ms" }).notNull(),
    periodTo: integer("periodTo", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["Draft", "Ready", "Filed", "Paid"] })
      .notNull()
      .default("Draft"),
    ratePercentUsed: real("ratePercentUsed").notNull().default(0),
    taxableBaseMyr: real("taxableBaseMyr").notNull().default(0),
    taxAmountMyr: real("taxAmountMyr").notNull().default(0),
    dueDate: integer("dueDate", { mode: "timestamp_ms" }),
    filedAt: integer("filedAt", { mode: "timestamp_ms" }),
    paidAt: integer("paidAt", { mode: "timestamp_ms" }),
    glEntryId: text("glEntryId"),
    receiptRef: text("receiptRef"),
    note: text("note"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    createdBy: text("createdBy"),
  },
  (t) => [
    index("tax_return_batch_type_status_idx").on(t.taxTypeId, t.status),
    index("tax_return_batch_dueDate_idx").on(t.dueDate),
  ],
);

export const taxReturnBatchOrder = sqliteTable(
  "tax_return_batch_order",
  {
    batchId: text("batchId").notNull(),
    orderId: text("orderId").notNull(),
    revenueMyr: real("revenueMyr").notNull().default(0),
    cogsMyr: real("cogsMyr").notNull().default(0),
    taxShareMyr: real("taxShareMyr").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.batchId, t.orderId] }),
    index("tax_return_batch_order_orderId_idx").on(t.orderId),
  ],
);

export const taxObligation = sqliteTable(
  "tax_obligation",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("orderId").notNull(),
    productId: integer("productId"),
    taxTypeId: integer("taxTypeId").notNull(),
    transactionDate: integer("transactionDate", { mode: "timestamp_ms" }).notNull(),
    revenueMyr: real("revenueMyr").notNull().default(0),
    ratePercent: real("ratePercent").notNull().default(0),
    taxAmountMyr: real("taxAmountMyr").notNull().default(0),
    status: text("status", { enum: ["Open", "Included", "Filed", "Waived"] })
      .notNull()
      .default("Open"),
    batchId: text("batchId"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("tax_obligation_status_type_date_idx").on(t.status, t.taxTypeId, t.transactionDate),
    index("tax_obligation_orderId_idx").on(t.orderId),
    index("tax_obligation_batchId_idx").on(t.batchId),
  ],
);
