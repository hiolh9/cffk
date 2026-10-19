import { sql } from "drizzle-orm";
import { PUSH_MAX_ATTEMPTS } from "@/lib/push-utils";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user, order, productV2, productSku, createdAt, updatedAt } from "./schema-tables-a";

export const card = sqliteTable(
  "card",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("productId").notNull().references(() => productV2.id),
    productSkuId: integer("productSkuId").references(() => productSku.id),
    content: text("content").notNull(),
    status: text("status", { enum: ["UNUSED", "SOLD", "DISABLED"] }).notNull().default("UNUSED"),
    batchNo: text("batchNo"),
    orderId: integer("orderId").references(() => order.id, { onDelete: "set null" }),
    soldAt: integer("soldAt", { mode: "timestamp_ms" }),
    createdAt,
    updatedAt,
  },
  (table) => [index("card_product_status_idx").on(table.productId, table.status), index("card_orderId_idx").on(table.orderId)],
);

export const orderDelivery = sqliteTable(
  "orderDelivery",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("orderId").notNull().references(() => order.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    deliveredAt: integer("deliveredAt", { mode: "timestamp_ms" }).notNull(),
    createdAt,
  },
  (table) => [index("orderDelivery_orderId_idx").on(table.orderId)],
);

export const paymentAttempt = sqliteTable(
  "paymentAttempt",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("orderId").notNull().references(() => order.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    amount: integer("amount").notNull(),
    externalId: text("externalId"),
    rawJson: text("rawJson"),
    createdAt,
    updatedAt,
  },
  (table) => [index("paymentAttempt_orderId_idx").on(table.orderId)],
);

export const automaticDeliveryJob = sqliteTable(
  "automaticDeliveryJob",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("orderId").notNull().references(() => order.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("lastError"),
    createdAt,
    updatedAt,
  },
  (table) => [index("automaticDeliveryJob_orderId_idx").on(table.orderId)],
);

export const orderEvent = sqliteTable(
  "orderEvent",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("orderId").notNull().references(() => order.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payloadJson: text("payloadJson"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("orderEvent_orderId_idx").on(table.orderId)],
);

export const transactionGuard = sqliteTable("transactionGuard", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
});

export const paymentProvider = sqliteTable(
  "paymentProvider",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    configJson: text("configJson"),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("paymentProvider_code_unique").on(table.code)],
);

export const paymentLog = sqliteTable(
  "paymentLog",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("orderId").references(() => order.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    direction: text("direction").notNull(),
    payloadJson: text("payloadJson"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("paymentLog_orderId_idx").on(table.orderId)],
);

export const pushChannelConfig = sqliteTable(
  "pushChannelConfig",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    channel: text("channel").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    configJson: text("configJson"),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("pushChannelConfig_channel_unique").on(table.channel)],
);

export const orderRequestRateLimit = sqliteTable("orderRequestRateLimit", {
  keyHash: text("keyHash").primaryKey(),
  requestCount: integer("requestCount").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const guestOrderRecoveryChallenge = sqliteTable(
  "guestOrderRecoveryChallenge",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    codeHash: text("codeHash").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("guestOrderRecoveryChallenge_email_idx").on(table.email)],
);

export const emailTemplate = sqliteTable(
  "emailTemplate",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scene: text("scene").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("bodyHtml").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("emailTemplate_scene_unique").on(table.scene)],
);

export const pushPolicy = sqliteTable(
  "pushPolicy",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scene: text("scene").notNull(),
    channel: text("channel").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("pushPolicy_scene_channel_unique").on(table.scene, table.channel)],
);

export const pushLog = sqliteTable(
  "pushLog",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scene: text("scene").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull(),
    recipient: text("recipient"),
    error: text("error"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("pushLog_createdAt_idx").on(table.createdAt)],
);

export const pushRetry = sqliteTable(
  "pushRetry",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scene: text("scene").notNull(),
    channel: text("channel").notNull(),
    payloadJson: text("payloadJson").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("maxAttempts").notNull().default(PUSH_MAX_ATTEMPTS),
    nextRetryAt: integer("nextRetryAt", { mode: "timestamp_ms" }),
    status: text("status").notNull().default("PENDING"),
    lastError: text("lastError"),
    createdAt,
    updatedAt,
  },
  (table) => [index("pushRetry_status_next_idx").on(table.status, table.nextRetryAt)],
);
