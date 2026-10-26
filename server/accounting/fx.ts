import { and, eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { fxMonthlyRate } from "@/database/drizzle/schema-settlement";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Calendar year-month in Asia/Kuala_Lumpur */
export function toYearMonthKL(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

export function previousYearMonthKL(fromMs = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(fromMs));
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 1970);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const d = new Date(Date.UTC(y, m - 2, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

/**
 * Resolve monthly average FX: 1 unit of `currency` → MYR.
 * MYR always 1. Falls back to previous month once if current missing.
 */
export async function resolveTransactionFxRate(
  database: D1Database,
  currency: string,
  transactionDateMs: number,
): Promise<{ rate: number; yearMonth: string; source: string }> {
  const ccy = currency.trim().toUpperCase();
  if (ccy === "MYR" || ccy === "RM") {
    return { rate: 1, yearMonth: toYearMonthKL(transactionDateMs), source: "UNITY" };
  }

  const db = createDrizzleDb(database);
  const ym = toYearMonthKL(transactionDateMs);
  const [row] = await db
    .select()
    .from(fxMonthlyRate)
    .where(and(eq(fxMonthlyRate.yearMonth, ym), eq(fxMonthlyRate.currency, ccy)))
    .limit(1);
  if (row) return { rate: Number(row.rateToMyr), yearMonth: ym, source: row.source };

  // fallback: previous month
  const [y, m] = ym.split("-").map(Number);
  const prevDate = new Date(Date.UTC(y!, m! - 2, 1));
  const prevYm = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const [prev] = await db
    .select()
    .from(fxMonthlyRate)
    .where(and(eq(fxMonthlyRate.yearMonth, prevYm), eq(fxMonthlyRate.currency, ccy)))
    .limit(1);
  if (prev) return { rate: Number(prev.rateToMyr), yearMonth: prevYm, source: `${prev.source}:FALLBACK` };

  throw new Error(`FX_RATE_MISSING:${ccy}:${ym}`);
}

export async function upsertFxRates(
  database: D1Database,
  yearMonth: string,
  rates: Record<string, number>,
  source = "BNM",
) {
  const db = createDrizzleDb(database);
  const now = new Date();
  for (const [currency, rateToMyr] of Object.entries(rates)) {
    const ccy = currency.toUpperCase();
    if (!Number.isFinite(rateToMyr) || rateToMyr <= 0) continue;
    await db
      .insert(fxMonthlyRate)
      .values({
        yearMonth,
        currency: ccy,
        rateToMyr,
        source,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [fxMonthlyRate.yearMonth, fxMonthlyRate.currency],
        set: { rateToMyr, source, fetchedAt: now },
      });
  }
}

/**
 * Fetch daily mid rates from BNM Open API and average for a calendar month.
 * https://api.bnm.gov.my — session required; best-effort.
 */
export async function fetchBnmMonthlyAverageRates(yearMonth: string): Promise<Record<string, number>> {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  if (!year || !month) throw new Error("YEAR_MONTH_INVALID");

  const currencies = ["USD", "SGD", "AUD", "JPY", "EUR", "GBP", "CNY"];
  const sums: Record<string, { total: number; n: number }> = {};
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    try {
      const res = await fetch(`https://api.bnm.gov.my/public/exchange-rate?date=${date}`, {
        headers: {
          Accept: "application/vnd.BNM.API.v1+json",
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as {
        data?: Array<{ currency_code?: string; rate?: { middle?: number; buying?: number; selling?: number } }>;
      };
      for (const item of body.data ?? []) {
        const code = (item.currency_code || "").toUpperCase();
        if (!currencies.includes(code)) continue;
        const mid =
          item.rate?.middle
          ?? (item.rate?.buying != null && item.rate?.selling != null
            ? (Number(item.rate.buying) + Number(item.rate.selling)) / 2
            : null);
        if (mid == null || !Number.isFinite(mid) || mid <= 0) continue;
        // BNM quotes unit varies (e.g. JPY often per 100). Heuristic: JPY rates often > 1 for per-100.
        let rateToMyr = Number(mid);
        if (code === "JPY" && rateToMyr > 0.5) rateToMyr = rateToMyr / 100;
        const bucket = sums[code] ?? { total: 0, n: 0 };
        bucket.total += rateToMyr;
        bucket.n += 1;
        sums[code] = bucket;
      }
    } catch {
      /* skip day */
    }
  }

  const out: Record<string, number> = {};
  for (const [code, { total, n }] of Object.entries(sums)) {
    if (n > 0) out[code] = round2(total / n);
  }
  return out;
}

export async function syncPreviousMonthBnmRates(database: D1Database, now = new Date()) {
  const ym = previousYearMonthKL(now.getTime());
  const rates = await fetchBnmMonthlyAverageRates(ym);
  if (Object.keys(rates).length === 0) {
    return { yearMonth: ym, stored: 0, rates };
  }
  await upsertFxRates(database, ym, rates, "BNM");
  return { yearMonth: ym, stored: Object.keys(rates).length, rates };
}
