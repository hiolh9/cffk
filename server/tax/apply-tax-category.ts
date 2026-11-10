/**
 * server/tax/apply-tax-category.ts
 * Call after order is PAID (can run after or instead of thin nexus apply).
 */
import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, productV2 } from "@/database/drizzle/schema";
import { evaluateOrderSst, type ProductTaxCategory } from "@/server/tax/sst-category-engine";

export async function applyProductTaxCategoryToPaidOrder(
  database: D1Database,
  orderId: number,
  opts?: { ipCountry?: string | null; cardCountry?: string | null },
) {
  const db = createDrizzleDb(database);
  const [row] = await db
    .select({
      id: order.id,
      amount: order.amount,
      productId: order.productId,
      customerIpCountry: order.customerIpCountry,
      cardIssuingCountry: order.cardIssuingCountry,
      productTaxCategory: order.productTaxCategory,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!row) return null;

  let category = (row.productTaxCategory as ProductTaxCategory | null) || null;
  if (!category && row.productId) {
    const [p] = await db
      .select({ taxCategory: productV2.taxCategory })
      .from(productV2)
      .where(eq(productV2.id, row.productId))
      .limit(1);
    category = (p?.taxCategory as ProductTaxCategory) || "Digital_Goods";
  }
  if (!category) category = "Digital_Goods";

  const ipCountry = opts?.ipCountry ?? row.customerIpCountry ?? null;
  const cardCountry = opts?.cardCountry ?? row.cardIssuingCountry ?? null;

  const tax = await evaluateOrderSst(database, {
    productTaxCategory: category,
    orderAmountMyr: (Number(row.amount) || 0) / 100,
    ipCountry,
    cardCountry,
  });

  await db
    .update(order)
    .set({
      productTaxCategory: tax.productTaxCategory,
      taxResidencyRegion: tax.taxResidencyRegion,
      customerIpCountry: ipCountry,
      cardIssuingCountry: cardCountry,
      sstApplicable: tax.sstApplicable,
      sstAmountMyrCents: Math.round(tax.sstAmountMyr * 100),
      localTaxCollectedMyrCents: Math.round(tax.sstAmountMyr * 100),
      taxType: tax.sstApplicable ? "MY_SST" : tax.exemptReason?.startsWith("Export") ? "Export_Exempt" : "None",
      taxExemptReason: tax.exemptReason,
      grossAmountMyrCents: Number(row.amount) || 0,
      updatedAt: new Date(),
    })
    .where(eq(order.id, orderId));

  return tax;
}
