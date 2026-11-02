/**
 * server/order/cogs.ts
 * Record / update order COGS (manual Taobao or supplier live cost).
 * P&L uses cogsAmountMyrCents (actual MYR outflow). Optional CNY + BNM for FX bridge.
 */
import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order } from "@/database/drizzle/schema";
import { acctSale } from "@/database/drizzle/schema-settlement";
import { resolveTransactionFxRate, round2 } from "@/server/accounting/fx";
import { writeAuditLog } from "@/server/accounting/audit";

export type CogsSource = "LOCAL_PREPAID" | "CROSS_BORDER" | "LOCAL_STOCK";

export type SetOrderCogsInput = {
  orderId: number;
  /** Actual MYR paid (major units, e.g. 32.80). Primary COGS for P&L. */
  cogsAmountMyr: number;
  cogsSource?: CogsSource;
  /** Optional: Taobao CNY major units (e.g. 50.00) */
  cogsOriginalCny?: number | null;
  /**
   * Optional BNM rate: 1 CNY → MYR. If omitted and CNY provided, resolve monthly avg.
   */
  exchangeRateUsed?: number | null;
  note?: string | null;
  actorUserId?: string | null;
};

function toCents(myr: number): number {
  return Math.round(round2(myr) * 100);
}

/**
 * Admin / system: set order COGS and mirror onto acctSale if present.
 */
export async function setOrderCogs(database: D1Database, input: SetOrderCogsInput) {
  const db = createDrizzleDb(database);
  const myr = Number(input.cogsAmountMyr);
  if (!Number.isFinite(myr) || myr < 0) throw new Error("COGS_MYR_INVALID");

  const [row] = await db.select().from(order).where(eq(order.id, input.orderId)).limit(1);
  if (!row) throw new Error("ORDER_NOT_FOUND");

  const cogsAmountMyrCents = toCents(myr);
  let cogsOriginalCurrency: "MYR" | "CNY" | null = null;
  let cogsOriginalAmountMinor: string | null = null;
  let exchangeRateUsed: string | null = null;
  let fxDifferenceCents = 0;
  const source: CogsSource = input.cogsSource ?? (input.cogsOriginalCny != null ? "CROSS_BORDER" : "LOCAL_PREPAID");

  if (input.cogsOriginalCny != null && Number.isFinite(Number(input.cogsOriginalCny))) {
    const cny = round2(Number(input.cogsOriginalCny));
    cogsOriginalCurrency = "CNY";
    // store CNY in minor (fen): *100
    cogsOriginalAmountMinor = String(Math.round(cny * 100));

    let rate = input.exchangeRateUsed != null && Number.isFinite(Number(input.exchangeRateUsed))
      ? Number(input.exchangeRateUsed)
      : null;
    if (rate == null || rate <= 0) {
      try {
        const txMs = (row.paidAt ?? row.createdAt).getTime();
        const resolved = await resolveTransactionFxRate(database, "CNY", txMs);
        rate = resolved.rate;
      } catch {
        rate = null;
      }
    }
    if (rate != null && rate > 0) {
      exchangeRateUsed = String(round2(rate));
      const bnmMyrCents = toCents(cny * rate);
      // bank actual MYR − BNM-implied MYR
      fxDifferenceCents = cogsAmountMyrCents - bnmMyrCents;
    }
  }

  const before = {
    cogsAmountMyrCents: row.cogsAmountMyrCents,
    cogsSource: row.cogsSource,
    cogsOriginalCurrency: row.cogsOriginalCurrency,
    cogsOriginalAmountMinor: row.cogsOriginalAmountMinor,
    exchangeRateUsed: row.exchangeRateUsed,
    fxDifferenceCents: row.fxDifferenceCents,
  };

  await db
    .update(order)
    .set({
      cogsSource: source,
      cogsAmountMyrCents,
      cogsOriginalCurrency,
      cogsOriginalAmountMinor,
      exchangeRateUsed,
      fxDifferenceCents,
      updatedAt: new Date(),
    })
    .where(eq(order.id, input.orderId));

  // Mirror accounting sale COGS (MYR major)
  const orderIdKey = (row.invoiceNo || row.orderNo || "").trim();
  if (orderIdKey) {
    const cogsMyr = round2(cogsAmountMyrCents / 100);
    await db
      .update(acctSale)
      .set({ cogsMyr, updatedAt: new Date() })
      .where(eq(acctSale.orderId, orderIdKey));
  }

  try {
    await writeAuditLog(database, {
      actionType: "Update",
      tableName: "order",
      recordId: String(input.orderId),
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify({
        cogsAmountMyrCents,
        cogsSource: source,
        cogsOriginalCurrency,
        cogsOriginalAmountMinor,
        exchangeRateUsed,
        fxDifferenceCents,
        note: input.note ?? null,
      }),
      userId: input.actorUserId ?? null,
    });
  } catch {
    /* audit optional if helper signature differs */
  }

  return {
    orderId: input.orderId,
    cogsAmountMyrCents,
    cogsMyr: round2(cogsAmountMyrCents / 100),
    cogsSource: source,
    exchangeRateUsed,
    fxDifferenceCents,
    fxDifferenceMyr: round2(fxDifferenceCents / 100),
  };
}

/**
 * After supplier fulfill: convert supplier totalCostMinor (account currency) → MYR COGS.
 */
export async function applySupplierCostToOrder(
  database: D1Database,
  input: {
    orderId: number;
    totalCostMinor: string;
    currency: string;
    currencyDecimals: number;
    provider?: string;
  },
) {
  const decimals = input.currencyDecimals ?? 2;
  const minor = BigInt(input.totalCostMinor || "0");
  const major = decimals === 0 ? Number(minor) : Number(minor) / 10 ** decimals;
  const ccy = (input.currency || "MYR").toUpperCase();

  let cogsMyr = major;
  if (ccy !== "MYR") {
    try {
      const { rate } = await resolveTransactionFxRate(database, ccy, Date.now());
      cogsMyr = major * rate;
    } catch {
      // leave as major if rate missing (admin can correct)
      cogsMyr = major;
    }
  }

  return setOrderCogs(database, {
    orderId: input.orderId,
    cogsAmountMyr: cogsMyr,
    cogsSource: input.provider === "moogold" ? "LOCAL_PREPAID" : "LOCAL_PREPAID",
    cogsOriginalCny: ccy === "CNY" ? major : null,
    note: `supplier:${input.provider ?? "api"}:${ccy}:${input.totalCostMinor}`,
  });
}
