import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt, user } from "./schema-tables-a-auth";

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
    ratingValue: text("ratingValue"),
    reviewCount: integer("reviewCount"),
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
    regionalPricesJson: text("regionalPricesJson"),
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
