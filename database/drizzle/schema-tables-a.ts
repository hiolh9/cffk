import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const createdAt = integer("createdAt", { mode: "timestamp_ms" }).notNull();
export const updatedAt = integer("updatedAt", { mode: "timestamp_ms" }).notNull();

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
    emailChangeRequestedAt: integer("emailChangeRequestedAt", { mode: "timestamp_ms" }),
    emailChangePendingEmail: text("emailChangePendingEmail"),
    emailChangeLastSentAt: integer("emailChangeLastSentAt", { mode: "timestamp_ms" }),
    disabledAt: integer("disabledAt", { mode: "timestamp_ms" }),
    image: text("image"),
    twoFactorEnabled: integer("twoFactorEnabled", { mode: "boolean" }).notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("user_email_lower_unique").on(sql`lower(${table.email})`)],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt,
    updatedAt,
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull().references(() => user.id),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull().references(() => user.id),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt,
    updatedAt,
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const twoFactor = sqliteTable("twoFactor", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().unique().references(() => user.id),
  secret: text("secret").notNull(),
  backupCodes: text("backupCodes").notNull(),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  failedVerificationCount: integer("failedVerificationCount").notNull().default(0),
  lockedUntil: integer("lockedUntil", { mode: "timestamp_ms" }),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
});

export const adminBootstrap = sqliteTable("adminBootstrap", {
  id: integer("id").primaryKey().default(1),
  userId: text("userId").notNull().references(() => user.id),
  createdAt,
});

export const siteSetting = sqliteTable("siteSetting", {
  id: integer("id").primaryKey().default(1),
  siteName: text("siteName").notNull(),
  siteUrl: text("siteUrl"),
  siteSubtitle: text("siteSubtitle"),
  logo: text("logo"),
  logoIcon: text("logoIcon"),
  notice: text("notice"),
  supportContact: text("supportContact"),
  footerText: text("footerText"),
  orderNotice: text("orderNotice"),
  headCode: text("headCode"),
  footerCode: text("footerCode"),
  registrationEnabled: integer("registrationEnabled", { mode: "boolean" }).notNull().default(false),
  timezone: text("timezone").notNull().default("Asia/Shanghai"),
  createdAt,
  updatedAt,
});

export const category = sqliteTable(
  "category",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    sort: integer("sort").notNull().default(0),
    status: text("status", { enum: ["ACTIVE", "DISABLED"] }).notNull().default("ACTIVE"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("category_slug_unique").on(table.slug),
    index("category_status_sort_idx").on(table.status, table.sort),
  ],
);

export const productV2 = sqliteTable(
  "product_v2",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("categoryId").references(() => category.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    coverImage: text("coverImage"),
    status: text("status", { enum: ["DRAFT", "ACTIVE", "INACTIVE"] }).notNull().default("DRAFT"),
    manualDeliveryHint: text("manualDeliveryHint"),
    sort: integer("sort").notNull().default(0),
    purchaseNote: text("purchaseNote"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("product_v2_slug_unique").on(table.slug),
    index("product_v2_categoryId_idx").on(table.categoryId),
    index("product_v2_status_sort_idx").on(table.status, table.sort),
  ],
);

export const productSku = sqliteTable(
  "productSku",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("productId").notNull().references(() => productV2.id),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    status: text("status", { enum: ["ACTIVE", "INACTIVE"] }).notNull().default("ACTIVE"),
    fulfillmentSource: text("fulfillmentSource", { enum: ["LOCAL", "SUPPLIER"] }).notNull().default("LOCAL"),
    deliveryType: text("deliveryType", {
      enum: ["CARD_AUTO", "FIXED_CARD", "MANUAL", "EXPRESS", "SUPPLIER"],
    }).notNull(),
    fixedDeliveryContent: text("fixedDeliveryContent"),
    physicalStock: integer("physicalStock"),
    minBuy: integer("minBuy").notNull().default(1),
    maxBuy: integer("maxBuy").notNull().default(1),
    sort: integer("sort").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("productSku_product_name_unique").on(table.productId, table.name),
    index("productSku_product_status_sort_idx").on(table.productId, table.status, table.sort),
  ],
);

export const discountCode = sqliteTable(
  "discountCode",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    type: text("type", { enum: ["FIXED", "PERCENT"] }).notNull(),
    value: integer("value").notNull(),
    minAmount: integer("minAmount"),
    maxUses: integer("maxUses"),
    usedCount: integer("usedCount").notNull().default(0),
    reservedCount: integer("reservedCount").notNull().default(0),
    productIds: text("productIds"),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("discountCode_code_unique").on(table.code),
    index("discountCode_active_idx").on(table.isActive),
  ],
);

export const customerAddress = sqliteTable(
  "customerAddress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    address: text("address").notNull(),
    isDefault: integer("isDefault", { mode: "boolean" }).notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [index("customerAddress_userId_idx").on(table.userId)],
);

/**
 * Order ledger fields (MYR cents unless noted):
 * - Gross = originalAmount ?? amount (customer pays MYR)
 * - Fee = paymentFeeCents (0 for DIRECT_TRANSFER)
 * - Net = Gross - Fee
 * - COGS split: local prepaid (MYR) vs cross-border (CNY + FX)
 */
export const order = sqliteTable(
  "order",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderNo: text("orderNo").notNull(),
    ownerUserId: text("ownerUserId").references(() => user.id),
    productId: integer("productId").references(() => productV2.id, { onDelete: "set null" }),
    productSkuId: integer("productSkuId").references(() => productSku.id, { onDelete: "set null" }),
    productNameSnapshot: text("productNameSnapshot").notNull(),
    productSkuNameSnapshot: text("productSkuNameSnapshot"),
    unitPrice: integer("unitPrice").notNull(),
    quantity: integer("quantity").notNull(),
    amount: integer("amount").notNull(),
    contactType: text("contactType", { enum: ["EMAIL", "QQ", "TELEGRAM", "OTHER"] }).notNull().default("EMAIL"),
    contactValue: text("contactValue"),
    contactEmailNormalized: text("contactEmailNormalized"),
    buyerNote: text("buyerNote"),
    addressSnapshotJson: text("addressSnapshotJson"),
    paymentProvider: text("paymentProvider").notNull(),
    paymentChannel: text("paymentChannel"),
    fulfillmentSourceSnapshot: text("fulfillmentSourceSnapshot", { enum: ["LOCAL", "SUPPLIER"] }).notNull().default("LOCAL"),
    deliveryTypeSnapshot: text("deliveryTypeSnapshot", {
      enum: ["CARD_AUTO", "FIXED_CARD", "MANUAL", "EXPRESS", "SUPPLIER"],
    }).notNull(),
    fixedDeliveryContentSnapshot: text("fixedDeliveryContentSnapshot"),
    physicalStockReserved: integer("physicalStockReserved", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["PENDING", "PAID", "DELIVERED", "CLOSED", "FAILED"] }).notNull().default("PENDING"),
    paymentStatus: text("paymentStatus", { enum: ["UNPAID", "PAID", "FAILED"] }).notNull().default("UNPAID"),
    deliveryStatus: text("deliveryStatus", {
      enum: ["NOT_DELIVERED", "DELIVERING", "DELIVERED", "FAILED"],
    }).notNull().default("NOT_DELIVERED"),
    deliveryToken: text("deliveryToken"),
    deliveryLeaseUntil: integer("deliveryLeaseUntil", { mode: "timestamp_ms" }),
    discountCodeId: integer("discountCodeId").references(() => discountCode.id, { onDelete: "set null" }),
    discountCodeStr: text("discountCodeStr"),
    originalAmount: integer("originalAmount"),
    discountAmount: integer("discountAmount"),
    paidAt: integer("paidAt", { mode: "timestamp_ms" }),
    deliveredAt: integer("deliveredAt", { mode: "timestamp_ms" }),
    closedAt: integer("closedAt", { mode: "timestamp_ms" }),
    invoiceNo: text("invoiceNo"),
    paymentFeeCents: integer("paymentFeeCents").notNull().default(0),
    paymentMethodKind: text("paymentMethodKind", { enum: ["GATEWAY", "DIRECT_TRANSFER"] }).notNull().default("GATEWAY"),
    /** LOCAL_PREPAID = MYR supplier prepaid; CROSS_BORDER = CNY (e.g. Taobao); LOCAL_STOCK = card/local inventory */
    cogsSource: text("cogsSource", {
      enum: ["LOCAL_PREPAID", "CROSS_BORDER", "LOCAL_STOCK"],
    }),
    /** Actual COGS in MYR sen (cents) for P&L */
    cogsAmountMyrCents: integer("cogsAmountMyrCents").notNull().default(0),
    /** Original purchase currency when different from MYR */
    cogsOriginalCurrency: text("cogsOriginalCurrency", { enum: ["MYR", "CNY"] }),
    /** Original cost in minor units of cogsOriginalCurrency (string for large ints) */
    cogsOriginalAmountMinor: text("cogsOriginalAmountMinor"),
    /** BNM or bank mid rate used for e-Invoice / conversion (e.g. "0.6523") */
    exchangeRateUsed: text("exchangeRateUsed"),
    /** Bank debit MYR sen minus BNM-converted MYR sen; positive = FX loss */
    fxDifferenceCents: integer("fxDifferenceCents").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("order_orderNo_unique").on(table.orderNo),
    index("order_productId_idx").on(table.productId),
    index("order_ownerUserId_createdAt_idx").on(table.ownerUserId, table.createdAt),
    index("order_guestEmail_createdAt_idx").on(table.contactEmailNormalized, table.createdAt),
    index("order_status_createdAt_idx").on(table.status, table.createdAt),
    index("order_paymentStatus_createdAt_idx").on(table.paymentStatus, table.createdAt),
    index("order_deliveryStatus_createdAt_idx").on(table.deliveryStatus, table.createdAt),
    index("order_cogsSource_idx").on(table.cogsSource),
  ],
);
