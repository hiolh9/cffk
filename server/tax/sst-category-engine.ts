/**
 * server/tax/sst-category-engine.ts
 *
 * Product tax categories:
 * - Digital_Goods  (e.g. game top-up / diamonds): never MY SST on sale; still income for LHDN
 * - Digital_Service (e.g. CapCut membership): MY local may attract SST after RM500k rolling (services only)
 *
 * Residency for this engine (SST-oriented, conservative):
 * - IP or BIN is MY → MY
 * - either missing, or both present but conflict → MY (待补证据时先按本地，避免少计门槛)
 * - both present, both non-MY, same → overseas
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order } from "@/database/drizzle/schema";
import { round2 } from "@/server/accounting/fx";

export type ProductTaxCategory = "Digital_Goods" | "Digital_Service";

export const MY_SST_SERVICE_THRESHOLD_MYR = 500_000;
export const MY_SST_RATE = 0.08;

export function normalizeCountry(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return c.length === 2 ? c : null;
}

/**
 * SST residency (conservative):
 * MY if either side is MY OR missing OR conflict; overseas only if both non-MY and equal.
 */
export function resolveSstResidency(
  ipCountry: string | null | undefined,
  cardCountry: string | null | undefined,
): "MY" | "OVERSEAS" {
  const ip = normalizeCountry(ipCountry);
  const bin = normalizeCountry(cardCountry);

  if (ip === "MY" || bin === "MY") return "MY";
  if (ip && bin && ip === bin) return "OVERSEAS";
  // missing or conflict → treat as MY for threshold / evidence-pending
  return "MY";
}

export type SstTaxResult = {
  productTaxCategory: ProductTaxCategory;
  taxResidencyRegion: string; // MY or overseas country code / OVERSEAS
  sstApplicable: boolean;
  sstAmountMyr: number;
  countsTowardMySstServiceThreshold: boolean;
  exemptReason: string | null;
  rollingDigitalServiceMyMyr: number;
};

/** Rolling 365d MY revenue for Digital_Service only (SST registration base). */
export async function sumRollingDigitalServiceMyMyr(
  database: D1Database,
  asOf: Date = new Date(),
): Promise<number> {
  const db = createDrizzleDb(database);
  const from = new Date(asOf);
  from.setUTCDate(from.getUTCDate() - 365);

  const rows = await db
    .select({
      sumCents: sql<number>`coalesce(sum(${order.amount}), 0)`,
    })
    .from(order)
    .where(
      and(
        eq(order.productTaxCategory, "Digital_Service"),
        eq(order.taxResidencyRegion, "MY"),
        gte(order.paidAt, from),
        lt(order.paidAt, asOf),
      ),
    );

  return round2(Number(rows[0]?.sumCents ?? 0) / 100);
}

export async function evaluateOrderSst(
  database: D1Database,
  input: {
    productTaxCategory: ProductTaxCategory;
    orderAmountMyr: number;
    ipCountry?: string | null;
    cardCountry?: string | null;
  },
): Promise<SstTaxResult> {
  const category = input.productTaxCategory === "Digital_Service" ? "Digital_Service" : "Digital_Goods";
  const amount = Math.max(0, Number(input.orderAmountMyr) || 0);
  const residency = resolveSstResidency(input.ipCountry, input.cardCountry);
  const ip = normalizeCountry(input.ipCountry);
  const bin = normalizeCountry(input.cardCountry);
  const regionCode =
    residency === "MY"
      ? "MY"
      : ip && bin && ip === bin
        ? ip
        : "OVERSEAS";

  // A) Digital goods: never SST on this model
  if (category === "Digital_Goods") {
    return {
      productTaxCategory: "Digital_Goods",
      taxResidencyRegion: regionCode,
      sstApplicable: false,
      sstAmountMyr: 0,
      countsTowardMySstServiceThreshold: false,
      exemptReason: residency === "MY" ? "Digital_Goods_not_SST_supply" : "Export_Digital_Goods",
      rollingDigitalServiceMyMyr: await sumRollingDigitalServiceMyMyr(database),
    };
  }

  // B) Digital service
  const rolling = await sumRollingDigitalServiceMyMyr(database);

  if (residency !== "MY") {
    return {
      productTaxCategory: "Digital_Service",
      taxResidencyRegion: regionCode,
      sstApplicable: false,
      sstAmountMyr: 0,
      countsTowardMySstServiceThreshold: false,
      exemptReason: "Exported_Services",
      rollingDigitalServiceMyMyr: rolling,
    };
  }

  // MY local service: counts toward threshold; charge SST only if already over threshold before this order
  const over = rolling >= MY_SST_SERVICE_THRESHOLD_MYR;
  const sstAmount = over ? round2(amount * MY_SST_RATE) : 0;

  return {
    productTaxCategory: "Digital_Service",
    taxResidencyRegion: "MY",
    sstApplicable: over,
    sstAmountMyr: sstAmount,
    countsTowardMySstServiceThreshold: true,
    exemptReason: over ? null : "Below_MY_SST_service_threshold",
    rollingDigitalServiceMyMyr: rolling,
  };
}
