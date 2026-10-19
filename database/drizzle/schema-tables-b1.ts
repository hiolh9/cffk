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
    orderId: integer("orderId").notNull().references(() => order.id),
    content: text("content").notNull(),
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
    channel: text("channel"),
    paymentOrderNo: text("paymentOrderNo"),
    status: text("status", { enum: ["CREATING", "PENDING", "PAID", "FAILED"] }).notNull().default("CREATING"),
    createdAt,
    updatedAt,
  },
  (table) => [index("paymentAttempt_orderId_createdAt_idx").on(table.orderId, table.createdAt)],
);

export const automaticDeliveryJob = sqliteTable(
  "automaticDeliveryJob",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("orderId").notNull().references(() => order.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("PENDING"),
    attemptCount: integer("attemptCount").notNull().default(0),
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
    provider: text("provider").notNull(),
    isEnabled: integer("isEnabled", { mode: "boolean" }).notNull().default(false),
    sort: integer("sort").notNull().default(0),
    configJson: text("configJson").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("paymentProvider_code_unique").on(table.code),
    index("paymentProvider_enabled_sort_idx").on(table.isEnabled, table.sort),
  ],
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
    channel: text("channel", { enum: ["EMAIL", "WECHAT", "TELEGRAM"] }).notNull(),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    isEnabled: integer("isEnabled", { mode: "boolean" }).notNull().default(false),
    configJson: text("configJson").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("pushChannelConfig_channel_provider_idx").on(table.channel, table.provider),
    index("pushChannelConfig_channel_enabled_idx").on(table.channel, table.isEnabled),
  ],
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
    attemptCount: integer("attemptCount").notNull().default(0),
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
    messageType: text("messageType", { enum: ["NORMAL", "ADMIN"] }).notNull(),
    scene: text("scene", { enum: ["ORDER_PAID", "DELIVERY_SUCCESS", "DELIVERY_FAILED", "PAYMENT_EXCEPTION"] }).notNull(),
    channelsJson: text("channelsJson").notNull().default("[]"),
    isEnabled: integer("isEnabled", { mode: "boolean" }).notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("pushPolicy_messageType_scene_unique").on(table.messageType, table.scene)],
);

export const pushLog = sqliteTable(
  "pushLog",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("orderId").references(() => order.id, { onDelete: "set null" }),
    channelConfigId: integer("channelConfigId").references(() => pushChannelConfig.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotencyKey"),
    messageType: text("messageType", { enum: ["NORMAL", "ADMIN"] }).notNull().default("NORMAL"),
    channel: text("channel", { enum: ["EMAIL", "WECHAT", "TELEGRAM"] }).notNull(),
    provider: text("provider").notNull(),
    scene: text("scene", {
      enum: [
        "TEST",
        "EMAIL_VERIFICATION",
        "PASSWORD_RESET",
        "GUEST_ORDER_RECOVERY",
        "ORDER_PAID",
        "DELIVERY_SUCCESS",
        "DELIVERY_FAILED",
        "PAYMENT_EXCEPTION",
      ],
    }).notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject"),
    status: text("status", {
      enum: ["PENDING", "PROCESSING", "SUCCESS", "FAILED", "SKIPPED", "EXHAUSTED"],
    }).notNull(),
    attemptCount: integer("attemptCount").notNull().default(0),
    messageId: text("messageId"),
    error: text("error"),
    triggeredBy: text("triggeredBy"),
    createdAt,
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("pushLog_idempotencyKey_unique").on(table.idempotencyKey),
    index("pushLog_channel_createdAt_idx").on(table.channel, table.createdAt),
    index("pushLog_status_createdAt_idx").on(table.status, table.createdAt),
    index("pushLog_orderId_idx").on(table.orderId),
  ],
);

export const pushRetry = sqliteTable(
  "pushRetry",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pushLogId: integer("pushLogId").notNull().references(() => pushLog.id, { onDelete: "cascade" }),
    payloadJson: text("payloadJson").notNull(),
    status: text("status", { enum: ["PENDING", "PROCESSING", "EXHAUSTED"] }).notNull().default("PENDING"),
    attemptCount: integer("attemptCount").notNull().default(0),
    maxAttempts: integer("maxAttempts").notNull().default(PUSH_MAX_ATTEMPTS),
    nextAttemptAt: integer("nextAttemptAt", { mode: "timestamp_ms" }).notNull(),
    lastError: text("lastError"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("pushRetry_status_nextAttemptAt_idx").on(table.status, table.nextAttemptAt),
    uniqueIndex("pushRetry_pushLogId_unique").on(table.pushLogId),
  ],
);
