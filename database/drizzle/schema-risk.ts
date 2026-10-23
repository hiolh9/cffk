import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const riskBlacklist = sqliteTable(
  "riskBlacklist",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** IP | USER | DEVICE | FP */
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    reason: text("reason"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("riskBlacklist_kind_value_uidx").on(t.kind, t.value)],
);

/** userId + deviceId bindings observed at checkout. */
export const riskDeviceSighting = sqliteTable(
  "riskDeviceSighting",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("userId").notNull(),
    deviceId: text("deviceId").notNull(),
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

export const riskUserScore = sqliteTable("riskUserScore", {
  userId: text("userId").primaryKey(),
  score: integer("score").notNull().default(0),
  reasonsJson: text("reasonsJson"),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});
