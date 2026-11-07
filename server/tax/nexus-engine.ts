/**
 * server/tax/nexus-engine.ts
 * Global tax residency + threshold engine (Cloudflare Workers / D1).
 *
 * Priority: Card_Issuing_Country > Customer_IP_Country for Tax_Residency_Region.
 * Below threshold → no local tax collected; still record region for rolling 12m tracking.
 * Export (non-tracked regions or tracked but treated as export for MY SST) → Export exempt for MY.
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order } from "@/database/drizzle/schema";
import { round2 } from "@/server/accounting/fx";

export type TaxType = "None" | "MY_SST" | "AU_GST" | "JP_JCT" | "Export_Exempt";

export type NexusRule = {
  region: string;
  taxType: TaxType;
  /** Threshold in local currency units */
  thresholdLocal: number;
  thresholdCurrency: string;
  ratePercent: number;
  /** Approximate MYR threshold for rolling sum in MYR books */
  thresholdMyrApprox: number;
};

/** Default rules (override via taxNexusConfig table when available). */
export const DEFAULT_NEXUS_RULES: Record<string, NexusRule> = {
  MY: {
    region: "MY",
    taxType: "MY_SST",
    thresholdLocal: 500_000,
    thresholdCurrency: "MYR",
    ratePercent: 8,
    thresholdMyrApprox: 500_000,
  },
  AU: {
    region: "AU",
    taxType: "AU_GST",
    thresholdLocal: 75_000,
    thresholdCurrency: "AUD",
    ratePercent: 10,
    thresholdMyrApprox: 225_000, // ~3 MYR/AUD placeholder; update with BNM
  },
  JP: {
    region: "JP",
    taxType: "JP_JCT",
    thresholdLocal: 10_000_000,
    thresholdCurrency: "JPY",
    ratePercent: 10,
    thresholdMyrApprox: 300_000, // rough; update with BNM
  },
};

export function normalizeCountry(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  if (c.length !== 2) return null;
  return c;
}

/**
 * Final consumption / tax residency:
 * prefer card issuing country (payment network evidence), else IP country.
 */
/**
 * 1) IP == MY 或 BIN(card) == MY → Tax_Residency = MY（本地应税）
 * 2) 仅当 IP != MY 且 BIN != MY 且 IP === BIN → 记该国（如 AU）
 * 3) 缺一边、或两边都非 MY 但不一致 → null（不记外国区，走出口/待补证据）
 */
export function resolveTaxResidency(
  ipCountry: string | null | undefined,
  cardCountry: string | null | undefined,
): string | null {
  const ip = normalizeCountry(ipCountry);
  const bin = normalizeCountry(cardCountry);

  if (ip === "MY" || bin === "MY") return "MY";

  if (ip && bin && ip === bin) return ip;

  return null;
}

export type TaxCalcInput = {
  orderAmountMyr: number;
  ipCountry?: string | null;
  cardCountry?: string | null;
  /** Rolling 12m gross MYR already recorded for this residency (excluding current order). */
  currentRollingSalesMyr: number;
  rules?: Record<string, NexusRule>;
};

export type TaxCalcResult = {
  taxResidencyRegion: string | null;
  taxType: TaxType;
  taxAmountMyr: number;
  ratePercent: number;
  /** Whether this order counts toward MY SST registration threshold */
  countsTowardMySstThreshold: boolean;
  /** Pool label for reporting */
  pool: "MY_SST_Tracker" | "Global_Nexus_Tracker" | "Export_Exempt_Pool";
  exemptReason: string | null;
  crossedThreshold: boolean;
};

export function calculateOrderTax(input: TaxCalcInput): TaxCalcResult {
  const rules = input.rules || DEFAULT_NEXUS_RULES;
  const region = resolveTaxResidency(input.ipCountry, input.cardCountry);
  const amount = Math.max(0, Number(input.orderAmountMyr) || 0);
  const rolling = Math.max(0, Number(input.currentRollingSalesMyr) || 0);

  if (!region) {
    return {
      taxResidencyRegion: null,
      taxType: "None",
      taxAmountMyr: 0,
      ratePercent: 0,
      countsTowardMySstThreshold: false,
      pool: "Export_Exempt_Pool",
      exemptReason: "Unknown_residency_treated_as_export",
      crossedThreshold: false,
    };
  }

  const rule = rules[region];
  if (!rule) {
    // e.g. US, EU — export for MY SST purposes
    return {
      taxResidencyRegion: region,
      taxType: "Export_Exempt",
      taxAmountMyr: 0,
      ratePercent: 0,
      countsTowardMySstThreshold: false,
      pool: "Export_Exempt_Pool",
      exemptReason: "Exported_Services",
      crossedThreshold: false,
    };
  }

  const threshold = rule.thresholdMyrApprox;
  const after = rolling + amount;
  const crossed = rolling >= threshold || after >= threshold;
  // Collect tax only once registration threshold already met (rolling before this order >= threshold)
  // OR if this order itself causes crossing — policy: start collecting from orders after threshold met.
  // Practical: if rolling >= threshold, collect on this order; if only after crosses, still 0 this order (alert ops).
  const shouldCollect = rolling >= threshold;
  const taxAmount = shouldCollect ? round2((amount * rule.ratePercent) / 100) : 0;

  if (region === "MY") {
    return {
      taxResidencyRegion: "MY",
      taxType: shouldCollect ? "MY_SST" : "None",
      taxAmountMyr: taxAmount,
      ratePercent: shouldCollect ? rule.ratePercent : 0,
      countsTowardMySstThreshold: true,
      pool: "MY_SST_Tracker",
      exemptReason: null,
      crossedThreshold: crossed,
    };
  }

  return {
    taxResidencyRegion: region,
    taxType: shouldCollect ? rule.taxType : "None",
    taxAmountMyr: taxAmount,
    ratePercent: shouldCollect ? rule.ratePercent : 0,
    countsTowardMySstThreshold: false,
    pool: "Global_Nexus_Tracker",
    exemptReason: shouldCollect ? null : null,
    crossedThreshold: crossed,
  };
}

/** Rolling 12 months gross MYR for a tax residency region (paid orders). */
export async function sumRolling12mGrossMyr(
  database: D1Database,
  region: string,
  asOf: Date = new Date(),
): Promise<number> {
  const db = createDrizzleDb(database);
  const to = asOf;
  const from = new Date(asOf);
  from.setUTCFullYear(from.getUTCFullYear() - 1);

  // Prefer grossAmountMyrCents; fallback amount field naming may vary
  const rows = await db
    .select({
      sumCents: sql<number>`coalesce(sum(coalesce(${order.grossAmountMyrCents}, ${order.amount}, 0)), 0)`,
    })
    .from(order)
    .where(
      and(
        eq(order.taxResidencyRegion, region),
        gte(order.paidAt, from),
        lt(order.paidAt, to),
      ),
    );

  const cents = Number(rows[0]?.sumCents ?? 0);
  // amount on order is often already cents; if grossAmountMyrCents used, /100
  // Heuristic: if values look like cents (large), divide — prefer grossAmountMyrCents when set.
  // Simpler: treat sum as cents when gross column used.
  return round2(cents / 100);
}

export async function evaluateTaxForNewOrder(
  database: D1Database,
  input: {
    orderAmountMyr: number;
    ipCountry?: string | null;
    cardCountry?: string | null;
  },
): Promise<TaxCalcResult> {
  const region = resolveTaxResidency(input.ipCountry, input.cardCountry);
  const rolling = region ? await sumRolling12mGrossMyr(database, region) : 0;
  return calculateOrderTax({
    orderAmountMyr: input.orderAmountMyr,
    ipCountry: input.ipCountry,
    cardCountry: input.cardCountry,
    currentRollingSalesMyr: rolling,
  });
}
