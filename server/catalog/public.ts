import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { card, category, productV2, productSku } from "@/database/drizzle/schema";
import { DEFAULT_STORE_CURRENCY, resolveListPrice, type StoreCurrency } from "@/lib/currency";
import { formatCentsAsYuan } from "@/lib/payment-utils";

export type PublicSku = {
  id: number;
  name: string;
  price: string;
  currency: StoreCurrency;
  deliveryType: "CARD_AUTO" | "FIXED_CARD" | "MANUAL" | "EXPRESS" | "SUPPLIER";
  physicalStock: number | null;
  availableStock: number | null;
  minBuy: number;
  maxBuy: number;
};

export type PublicCatalog = {
  categories: Array<{ id: number; name: string; slug: string; description: string | null }>;
  products: Array<{
    id: number;
    categoryId: number | null;
    categoryName: string | null;
    name: string;
    slug: string;
    subtitle: string | null;
    coverImage: string | null;
    price: string;
    currency: StoreCurrency;
    deliveryType: "CARD_AUTO" | "FIXED_CARD" | "MANUAL" | "EXPRESS" | "SUPPLIER";
    physicalStock: number | null;
    availableStock: number | null;
    minBuy: number;
    maxBuy: number;
  }>;
};

export type PublicProductDetail = PublicCatalog["products"][number] & {
  description: string | null;
  purchaseNote: string | null;
  manualDeliveryHint: string | null;
  ratingValue: string | null;
  reviewCount: number | null;
  buyerFormJson: string | null;
  skus: PublicSku[];
};

function resolveSkuPrice(baseMinor: number, regionalPricesJson: string | null | undefined, preferred: StoreCurrency) {
  return resolveListPrice({
    preferredCurrency: preferred,
    baseMinor,
    defaultCurrency: DEFAULT_STORE_CURRENCY,
    regionalPricesJson,
  });
}

export async function getPublicProductDetail(
  database: D1Database,
  slug: string,
  preferredCurrency: StoreCurrency = DEFAULT_STORE_CURRENCY,
): Promise<PublicProductDetail | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const db = createDrizzleDb(database);
  const [item] = await db
    .select({
      id: productV2.id,
      categoryId: productV2.categoryId,
      name: productV2.name,
      slug: productV2.slug,
      subtitle: productV2.subtitle,
      coverImage: productV2.coverImage,
      description: productV2.description,
      purchaseNote: productV2.purchaseNote,
      manualDeliveryHint: productV2.manualDeliveryHint,
      ratingValue: productV2.ratingValue,
      reviewCount: productV2.reviewCount,
      buyerFormJson: productV2.buyerFormJson,
      categoryName: category.name,
    })
    .from(productV2)
    .leftJoin(category, and(eq(productV2.categoryId, category.id), eq(category.status, "ACTIVE")))
    .where(and(eq(productV2.slug, normalizedSlug), eq(productV2.status, "ACTIVE")))
    .limit(1);
  if (!item) return null;

  const skuRows = await db
    .select({
      id: productSku.id,
      name: productSku.name,
      price: productSku.price,
      regionalPricesJson: productSku.regionalPricesJson,
      deliveryType: productSku.deliveryType,
      physicalStock: productSku.physicalStock,
      minBuy: productSku.minBuy,
      maxBuy: productSku.maxBuy,
    })
    .from(productSku)
    .where(and(eq(productSku.productId, item.id), eq(productSku.status, "ACTIVE")))
    .orderBy(asc(productSku.sort), asc(productSku.id));

  const skus = await Promise.all(
    skuRows.map(async (sku) => {
      const resolved = resolveSkuPrice(sku.price, sku.regionalPricesJson, preferredCurrency);
      return {
        id: sku.id,
        name: sku.name,
        price: resolved.price,
        currency: resolved.currency,
        deliveryType: sku.deliveryType,
        physicalStock: sku.physicalStock,
        minBuy: sku.minBuy,
        maxBuy: sku.maxBuy,
        availableStock:
          sku.deliveryType === "CARD_AUTO"
            ? await countAvailableCardStockBySku(db, sku.id)
            : sku.deliveryType === "SUPPLIER"
              ? null
              : sku.physicalStock,
      };
    }),
  );
  const primary = skus[0];
  if (!primary) return null;
  return {
    ...item,
    price: primary.price,
    currency: primary.currency,
    deliveryType: primary.deliveryType,
    physicalStock: primary.physicalStock,
    availableStock: primary.availableStock,
    minBuy: primary.minBuy,
    maxBuy: primary.maxBuy,
    skus,
  };
}

async function countAvailableCardStockBySku(db: ReturnType<typeof createDrizzleDb>, skuId: number) {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(card)
    .where(and(eq(card.productSkuId, skuId), eq(card.status, "UNUSED")));
  return result?.count ?? 0;
}

export async function getPublicCatalog(
  database: D1Database,
  preferredCurrency: StoreCurrency = DEFAULT_STORE_CURRENCY,
): Promise<PublicCatalog> {
  const db = createDrizzleDb(database);
  const categories = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
    })
    .from(category)
    .where(eq(category.status, "ACTIVE"))
    .orderBy(asc(category.sort), asc(category.id));

  const products = await db
    .select({
      id: productV2.id,
      categoryId: productV2.categoryId,
      name: productV2.name,
      slug: productV2.slug,
      subtitle: productV2.subtitle,
      coverImage: productV2.coverImage,
    })
    .from(productV2)
    .where(eq(productV2.status, "ACTIVE"))
    .orderBy(asc(productV2.sort), asc(productV2.id));

  const productIds = products.map((p) => p.id);
  const skuRows = productIds.length
    ? await db
        .select({
          id: productSku.id,
          productId: productSku.productId,
          name: productSku.name,
          price: productSku.price,
          regionalPricesJson: productSku.regionalPricesJson,
          deliveryType: productSku.deliveryType,
          physicalStock: productSku.physicalStock,
          minBuy: productSku.minBuy,
          maxBuy: productSku.maxBuy,
          sort: productSku.sort,
        })
        .from(productSku)
        .where(and(inArray(productSku.productId, productIds), eq(productSku.status, "ACTIVE")))
        .orderBy(asc(productSku.sort), asc(productSku.id))
    : [];

  const primaryByProduct = new Map<number, (typeof skuRows)[number]>();
  for (const sku of skuRows) {
    if (!primaryByProduct.has(sku.productId)) primaryByProduct.set(sku.productId, sku);
  }

  const cardSkuIds = skuRows.filter((s) => s.deliveryType === "CARD_AUTO").map((s) => s.id);
  const cardStockRows = cardSkuIds.length
    ? await db
        .select({
          productSkuId: card.productSkuId,
          availableStock: sql<number>`count(*)`,
        })
        .from(card)
        .where(and(inArray(card.productSkuId, cardSkuIds), eq(card.status, "UNUSED")))
        .groupBy(card.productSkuId)
    : [];
  const cardStockBySkuId = new Map(cardStockRows.map((item) => [item.productSkuId, item.availableStock]));
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return {
    categories,
    products: products.flatMap((item) => {
      const sku = primaryByProduct.get(item.id);
      if (!sku) return [];
      const resolved = resolveSkuPrice(sku.price, sku.regionalPricesJson, preferredCurrency);
      return [
        {
          ...item,
          price: resolved.price,
          currency: resolved.currency,
          deliveryType: sku.deliveryType,
          physicalStock: sku.physicalStock,
          availableStock:
            sku.deliveryType === "CARD_AUTO"
              ? cardStockBySkuId.get(sku.id) ?? 0
              : sku.deliveryType === "SUPPLIER"
                ? null
                : sku.physicalStock,
          minBuy: sku.minBuy,
          maxBuy: sku.maxBuy,
          categoryName: item.categoryId === null ? null : categoryNameById.get(item.categoryId) ?? null,
        },
      ];
    }),
  };
}

void formatCentsAsYuan;
