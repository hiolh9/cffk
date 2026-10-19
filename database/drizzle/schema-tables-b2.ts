import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user, productSku, createdAt, updatedAt } from "./schema-tables-a";

export const supplierAccount = sqliteTable(
  "supplierAccount",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: ["acg", "dujiao_next", "moogold"] }).notNull(),
    baseUrl: text("baseUrl").notNull(),
    normalizedApiOrigin: text("normalizedApiOrigin").notNull(),
    protocolVersion: text("protocolVersion").notNull(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("CNY"),
    currencyDecimals: integer("currencyDecimals").notNull().default(2),
    credentialsJson: text("credentialsJson").notNull(),
    credentialsRevision: integer("credentialsRevision").notNull().default(1),
    balanceMinor: text("balanceMinor"),
    balanceSyncedAt: integer("balanceSyncedAt", { mode: "timestamp_ms" }),
    reserveBalanceMinor: text("reserveBalanceMinor").notNull().default("0"),
    lowBalanceMinor: text("lowBalanceMinor").notNull().default("0"),
    maxOrderCostMinor: text("maxOrderCostMinor"),
    healthStatus: text("healthStatus", { enum: ["unknown", "healthy", "degraded", "unavailable"] }).notNull().default("unknown"),
    consecutiveFailures: integer("consecutiveFailures").notNull().default(0),
    cooldownUntil: integer("cooldownUntil", { mode: "timestamp_ms" }),
    lastSelectedAt: integer("lastSelectedAt", { mode: "timestamp_ms" }),
    lastErrorCode: text("lastErrorCode"),
    lastErrorAt: integer("lastErrorAt", { mode: "timestamp_ms" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("supplierAccount_source_name_unique").on(table.provider, table.normalizedApiOrigin, table.protocolVersion, table.name),
    index("supplierAccount_eligible_idx").on(table.provider, table.normalizedApiOrigin, table.enabled, table.healthStatus, table.cooldownUntil, table.lastSelectedAt),
    index("supplierAccount_updatedAt_idx").on(table.updatedAt),
  ],
);

export const supplierBinding = sqliteTable(
  "supplierBinding",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productSkuId: integer("productSkuId").notNull().references(() => productSku.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["acg", "dujiao_next", "moogold"] }).notNull(),
    normalizedApiOrigin: text("normalizedApiOrigin").notNull(),
    protocolVersion: text("protocolVersion").notNull(),
    upstreamProductId: text("upstreamProductId").notNull(),
    upstreamSkuId: text("upstreamSkuId").notNull(),
    upstreamSkuName: text("upstreamSkuName"),
    referenceCostMinor: text("referenceCostMinor").notNull().default("0"),
    maxCostMinor: text("maxCostMinor").notNull().default("999999999"),
    remoteStatus: text("remoteStatus").notNull().default("active"),
    stockQuantity: integer("stockQuantity").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("supplierBinding_sku_source_unique").on(table.productSkuId, table.provider, table.normalizedApiOrigin, table.protocolVersion),
    index("supplierBinding_source_idx").on(table.provider, table.normalizedApiOrigin),
  ],
);

export const supplierOrder = sqliteTable(
  "supplierOrder",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("orderId"),
    supplierBindingId: integer("supplierBindingId"),
    selectedAccountId: text("selectedAccountId"),
    selectedCredentialsRevision: integer("selectedCredentialsRevision"),
    provider: text("provider"),
    providerRequestNo: text("providerRequestNo"),
    upstreamOrderId: text("upstreamOrderId"),
    quantity: integer("quantity").notNull().default(1),
    quotedUnitCostMinor: text("quotedUnitCostMinor"),
    totalCostMinor: text("totalCostMinor"),
    state: text("state").notNull().default("pending"),
    attemptCount: integer("attemptCount").notNull().default(0),
    selectionCount: integer("selectionCount").notNull().default(0),
    lastErrorCode: text("lastErrorCode"),
    nextRetryAt: integer("nextRetryAt", { mode: "timestamp_ms" }),
    accountLockedAt: integer("accountLockedAt", { mode: "timestamp_ms" }),
    submittedAt: integer("submittedAt", { mode: "timestamp_ms" }),
    bindingSnapshotJson: text("bindingSnapshotJson"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("supplierOrder_state_retry_idx").on(table.state, table.nextRetryAt),
    index("supplierOrder_orderId_idx").on(table.orderId),
  ],
);

export const supplierSyncSettings = sqliteTable("supplierSyncSettings", {
  id: integer("id").primaryKey().default(1),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  intervalMs: integer("intervalMs").notNull().default(3600000),
  lastStartedAt: integer("lastStartedAt", { mode: "timestamp_ms" }),
  lastCompletedAt: integer("lastCompletedAt", { mode: "timestamp_ms" }),
  lastStatus: text("lastStatus", { enum: ["idle", "running", "success", "failed"] }).notNull().default("idle"),
  lastError: text("lastError"),
  createdAt,
  updatedAt,
});

export const scheduledTaskRun = sqliteTable(
  "scheduledTaskRun",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    task: text("task", { enum: ["MAINTENANCE"] }).notNull(),
    status: text("status", { enum: ["RUNNING", "SUCCESS", "PARTIAL", "FAILED"] }).notNull(),
    scannedOrderCount: integer("scannedOrderCount"),
    closedOrderCount: integer("closedOrderCount"),
    pushRetryAttempted: integer("pushRetryAttempted"),
    pushRetrySent: integer("pushRetrySent"),
    pushRetryExhausted: integer("pushRetryExhausted"),
    error: text("error"),
    startedAt: integer("startedAt", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completedAt", { mode: "timestamp_ms" }),
  },
  (table) => [index("scheduledTaskRun_task_startedAt_idx").on(table.task, table.startedAt)],
);

export const s3Config = sqliteTable("s3Config", {
  id: integer("id").primaryKey().default(1),
  configJson: text("configJson").notNull(),
  accessKeyId: text("accessKeyId"),
  secretAccessKey: text("secretAccessKey"),
  createdAt,
  updatedAt,
});

export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    originalName: text("originalName").notNull(),
    storedName: text("storedName").notNull(),
    mimeType: text("mimeType").notNull(),
    fileSize: integer("fileSize").notNull(),
    fileKey: text("fileKey").notNull(),
    url: text("url").notNull(),
    path: text("path"),
    metadataJson: text("metadataJson"),
    uploadedBy: text("uploadedBy").notNull().references(() => user.id),
    uploadedAt: integer("uploadedAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt,
  },
  (table) => [uniqueIndex("media_fileKey_unique").on(table.fileKey), index("media_mimeType_idx").on(table.mimeType), index("media_path_idx").on(table.path), index("media_uploadedAt_id_idx").on(table.uploadedAt, table.id)],
);
