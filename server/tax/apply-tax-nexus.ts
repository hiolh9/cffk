/**
 * server/tax/apply-tax-nexus.ts
 */
import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order } from "@/database/drizzle/schema";
import { evaluateTaxForNewOrder } from "@/server/tax/nexus-engine";

export async function applyTaxNexusToPaidOrder(
  database: D1Database,
  orderId: number,
  opts?: { ipCountry?: string | null; cardCountry?: string | null },
) {
  const db = createDrizzleDb(database);
  const [row] = await db
    .select({
      id: order.id,
      amount: order.amount,
      customerIpCountry: order.customerIpCountry,
      cardIssuingCountry: order.cardIssuingCountry,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!row) return null;

  const ipCountry = opts?.ipCountry ?? row.customerIpCountry ?? null;
  const cardCountry = opts?.cardCountry ?? row.cardIssuingCountry ?? null;

  const tax = await evaluateTaxForNewOrder(database, {
    orderAmountMyr: (Number(row.amount) || 0) / 100,
    ipCountry,
    cardCountry,
  });

  await db
    .update(order)
    .set({
      customerIpCountry: ipCountry,
      cardIssuingCountry: cardCountry,
      taxResidencyRegion: tax.taxResidencyRegion,
      localTaxCollectedMyrCents: Math.round(tax.taxAmountMyr * 100),
      taxType: tax.taxType,
      grossAmountMyrCents: Number(row.amount) || 0,
      taxExemptReason: tax.exemptReason,
      updatedAt: new Date(),
    })
    .where(eq(order.id, orderId));

  return tax;
}
