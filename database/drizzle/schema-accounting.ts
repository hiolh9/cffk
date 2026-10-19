import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const auditLog = sqliteTable(
  "auditLog",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: text("actorUserId"),
    actorEmail: text("actorEmail"),
    action: text("action").notNull(),
    entityType: text("entityType").notNull(),
    entityId: text("entityId").notNull(),
    beforeJson: text("beforeJson"),
    afterJson: text("afterJson"),
    note: text("note"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("auditLog_entity_idx").on(table.entityType, table.entityId),
    index("auditLog_createdAt_idx").on(table.createdAt),
  ],
);

export const invoiceSequence = sqliteTable("invoiceSequence", {
  id: integer("id").primaryKey().default(1),
  year: integer("year").notNull(),
  nextValue: integer("nextValue").notNull().default(1),
});

export const accountingArchive = sqliteTable(
  "accountingArchive",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    period: text("period").notNull(),
    rowCount: integer("rowCount").notNull(),
    objectKey: text("objectKey"),
    status: text("status").notNull().default("SUCCESS"),
    errorMessage: text("errorMessage"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("accountingArchive_period_unique").on(table.period)],
);
