import { sql } from "drizzle-orm";
import { PUSH_MAX_ATTEMPTS } from "@/lib/push-utils";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { auditLog, invoiceSequence, accountingArchive } from "./schema-accounting";
export { auditLog, invoiceSequence, accountingArchive };

const createdAt = integer("createdAt", { mode: "timestamp_ms" }).notNull();
const updatedAt = integer("updatedAt", { mode: "timestamp_ms" }).notNull();

// See database/drizzle/schema-full.ts for the complete schema body.
// Temporary bootstrap: re-export accounting tables only until full schema is restored.
export { auditLog as auditLogTable } from "./schema-accounting";

// Minimal stubs to unblock build — FULL SCHEMA MUST BE RESTORED
export const user = sqliteTable("user", { id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull(), emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(), image: text("image"), twoFactorEnabled: integer("twoFactorEnabled", { mode: "boolean" }), disabledAt: integer("disabledAt", { mode: "timestamp_ms" }), createdAt, updatedAt });
export const session = sqliteTable("session", { id: text("id").primaryKey(), expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(), token: text("token").notNull(), createdAt, updatedAt, ipAddress: text("ipAddress"), userAgent: text("userAgent"), userId: text("userId").notNull() });
export const account = sqliteTable("account", { id: text("id").primaryKey(), accountId: text("accountId").notNull(), providerId: text("providerId").notNull(), userId: text("userId").notNull(), password: text("password"), createdAt, updatedAt });
export const verification = sqliteTable("verification", { id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(), createdAt, updatedAt });
export const twoFactor = sqliteTable("twoFactor", { id: text("id").primaryKey(), secret: text("secret").notNull(), backupCodes: text("backupCodes").notNull(), userId: text("userId").notNull() });
export const adminBootstrap = sqliteTable("adminBootstrap", { userId: text("userId").primaryKey() });
export const siteSetting = sqliteTable("siteSetting", { id: integer("id").primaryKey().default(1), siteName: text("siteName"), registrationEnabled: integer("registrationEnabled", { mode: "boolean" }), createdAt, updatedAt });
export const category = sqliteTable("category", { id: integer("id").primaryKey({ autoIncrement: true }), name: text("name").notNull(), status: text("status").notNull(), sort: integer("sort").notNull().default(0) });
export const productV2 = sqliteTable("product_v2", { id: integer("id").primaryKey({ autoIncrement: true }), categoryId: integer("categoryId"), name: text("name").notNull(), slug: text("slug").notNull(), status: text("status").notNull(), sort: integer("sort").notNull().default(0) });
export const productSku = sqliteTable("product_sku", { id: integer("id").primaryKey({ autoIncrement: true }), productId: integer("productId").notNull(), name: text("name").notNull() });
export const discountCode = sqliteTable("discountCode", { id: integer("id").primaryKey({ autoIncrement: true }), code: text("code").notNull() });
export const order = sqliteTable("order", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderNo: text("orderNo").notNull(),
  ownerUserId: text("ownerUserId"),
  productId: integer("productId"),
  productSkuId: integer("productSkuId"),
  productNameSnapshot: text("productNameSnapshot").notNull(),
  productSkuNameSnapshot: text("productSkuNameSnapshot"),
  unitPrice: integer("unitPrice").notNull(),
  quantity: integer("quantity").notNull(),
  amount: integer("amount").notNull(),
  contactType: text("contactType").notNull().default("EMAIL"),
  contactValue: text("contactValue"),
  contactEmailNormalized: text("contactEmailNormalized"),
  buyerNote: text("buyerNote"),
  addressSnapshotJson: text("addressSnapshotJson"),
  paymentProvider: text("paymentProvider").notNull(),
  paymentChannel: text("paymentChannel"),
  fulfillmentSourceSnapshot: text("fulfillmentSourceSnapshot").notNull().default("LOCAL"),
  deliveryTypeSnapshot: text("deliveryTypeSnapshot").notNull(),
  fixedDeliveryContentSnapshot: text("fixedDeliveryContentSnapshot"),
  physicalStockReserved: integer("physicalStockReserved", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("PENDING"),
  paymentStatus: text("paymentStatus").notNull().default("UNPAID"),
  deliveryStatus: text("deliveryStatus").notNull().default("NOT_DELIVERED"),
  deliveryToken: text("deliveryToken"),
  deliveryLeaseUntil: integer("deliveryLeaseUntil", { mode: "timestamp_ms" }),
  discountCodeId: integer("discountCodeId"),
  discountCodeStr: text("discountCodeStr"),
  originalAmount: integer("originalAmount"),
  discountAmount: integer("discountAmount"),
  paidAt: integer("paidAt", { mode: "timestamp_ms" }),
  deliveredAt: integer("deliveredAt", { mode: "timestamp_ms" }),
  closedAt: integer("closedAt", { mode: "timestamp_ms" }),
  invoiceNo: text("invoiceNo"),
  paymentFeeCents: integer("paymentFeeCents").notNull().default(0),
  paymentMethodKind: text("paymentMethodKind").notNull().default("GATEWAY"),
  createdAt,
  updatedAt,
});
export const card = sqliteTable("card", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const orderDelivery = sqliteTable("orderDelivery", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const paymentAttempt = sqliteTable("paymentAttempt", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const automaticDeliveryJob = sqliteTable("automaticDeliveryJob", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const orderEvent = sqliteTable("orderEvent", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const transactionGuard = sqliteTable("transactionGuard", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const paymentProvider = sqliteTable("paymentProvider", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const paymentLog = sqliteTable("paymentLog", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const pushChannelConfig = sqliteTable("pushChannelConfig", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const orderRequestRateLimit = sqliteTable("orderRequestRateLimit", {
  keyHash: text("keyHash").primaryKey(),
  requestCount: integer("requestCount").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});
export const guestOrderRecoveryChallenge = sqliteTable("guestOrderRecoveryChallenge", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const emailTemplate = sqliteTable("emailTemplate", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const pushPolicy = sqliteTable("pushPolicy", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const pushLog = sqliteTable("pushLog", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const pushRetry = sqliteTable("pushRetry", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const supplierAccount = sqliteTable("supplierAccount", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  protocolVersion: text("protocolVersion").notNull(),
  baseUrl: text("baseUrl").notNull(),
  normalizedApiOrigin: text("normalizedApiOrigin").notNull(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  currencyDecimals: integer("currencyDecimals").notNull(),
  credentialsJson: text("credentialsJson").notNull(),
  credentialsRevision: integer("credentialsRevision").notNull().default(1),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt,
  updatedAt,
});
export const supplierBinding = sqliteTable("supplierBinding", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const supplierOrder = sqliteTable("supplierOrder", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const supplierSyncSettings = sqliteTable("supplierSyncSettings", { id: integer("id").primaryKey().default(1) });
export const scheduledTaskRun = sqliteTable("scheduledTaskRun", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const s3Config = sqliteTable("s3Config", { id: integer("id").primaryKey().default(1), configJson: text("configJson").notNull() });
export const media = sqliteTable("media", { id: integer("id").primaryKey({ autoIncrement: true }) });
export const customerAddress = sqliteTable("customerAddress", { id: integer("id").primaryKey({ autoIncrement: true }) });

export const schema = {
  user, session, account, verification, twoFactor, adminBootstrap, siteSetting,
  category, productV2, productSku, discountCode, order, card, orderDelivery,
  paymentAttempt, automaticDeliveryJob, orderEvent, transactionGuard, paymentProvider,
  paymentLog, pushChannelConfig, orderRequestRateLimit, guestOrderRecoveryChallenge,
  emailTemplate, pushPolicy, pushLog, pushRetry, scheduledTaskRun,
  supplierAccount, supplierBinding, supplierOrder, supplierSyncSettings,
  s3Config, media, auditLog, invoiceSequence, accountingArchive,
};
