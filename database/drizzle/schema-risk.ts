import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./schema-tables-a";

export const riskBlacklist = sqliteTable(
  "riskBlacklist",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** IP | USER | DEVICE */
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    reason: text("reason"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex("riskBlacklist_kind_value_uidx").on(t.kind, t.value)],
);
