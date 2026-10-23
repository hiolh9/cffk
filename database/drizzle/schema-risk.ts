import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./schema-tables-a";

export const riskBlacklist = sqliteTable(
  "riskBlacklist",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** IP | USER | DEVICE | FP */
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    reason: text("reason"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex("riskBlacklist_kind_value_uidx").on(t.kind, t.value)],
);

/** userId + deviceId bindings observed at checkout (strengthens device tracking). */
export const riskDeviceSighting = sqliteTable(
  "riskDeviceSighting",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("userId").notNull(),
    deviceId: text("deviceId").notNull(),
    /** Canvas/WebGL hard fingerprint hash (optional). */
    fpHash: text("fpHash"),
    clientIp: text("clientIp"),
    firstSeenAt: integer("firstSeenAt", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("lastSeenAt", { mode: "timestamp_ms" }).notNull(),
    sightingCount: integer("sightingCount").notNull().default(1),
  },
  (t) => [
    uniqueIndex("riskDeviceSighting_user_device_uidx").on(t.userId, t.deviceId),
    index("riskDeviceSighting_device_idx").on(t.deviceId),
    index("riskDeviceSighting_user_idx").on(t.userId),
    index("riskDeviceSighting_fp_idx").on(t.fpHash),
  ],
);

/** Latest lightweight behavior score per user (updated on checkout). */
export const riskUserScore = sqliteTable("riskUserScore", {
  userId: text("userId").primaryKey(),
  score: integer("score").notNull().default(0),
  reasonsJson: text("reasonsJson"),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});
