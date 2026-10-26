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

type BnmRateRow = {
  currency_code?: string;
  unit?: number;
  rate?: {
    middle_rate?: number;
    middle?: number;
    buying_rate?: number;
    selling_rate?: number;
    buying?: number;
    selling?: number;
    date?: string;
  };
};

/** Convert BNM quote to MYR per 1 unit of foreign currency */
function rateToMyrPerUnit(item: BnmRateRow): number | null {
  const rate = item.rate;
  if (!rate) return null;
  const mid =
    rate.middle_rate
    ?? rate.middle
    ?? (rate.buying_rate != null && rate.selling_rate != null
      ? (Number(rate.buying_rate) + Number(rate.selling_rate)) / 2
      : null)
    ?? (rate.buying != null && rate.selling != null
      ? (Number(rate.buying) + Number(rate.selling)) / 2
      : null);
  if (mid == null || !Number.isFinite(Number(mid)) || Number(mid) <= 0) return null;
  const unit = Number(item.unit);
  const divisor = Number.isFinite(unit) && unit > 0 ? unit : 1;
  return Number(mid) / divisor;
}

/**
 * Fetch BNM exchange rates and average across sample days in the month.
 * API fields: middle_rate / buying_rate / selling_rate + unit (e.g. JPY unit=100).
 * Note: some date queries may return the latest published board rate; we still
 * average successful samples. Prefer manual rates from official monthly stats for audits.
 */
export async function fetchBnmMonthlyAverageRates(yearMonth: string): Promise<Record<string, number>> {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  if (!year || !month) throw new Error("YEAR_MONTH_INVALID");

  const currencies = new Set(["USD", "SGD", "AUD", "JPY", "EUR", "GBP", "CNY"]);
  const sums: Record<string, { total: number; n: number }> = {};
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Sample several weekdays + last day (Workers time/CPU limits; avoid 30 sequential calls)
  const sampleDays = [...new Set([1, 5, 8, 12, 15, 19, 22, 26, daysInMonth])].filter(
    (d) => d >= 1 && d <= daysInMonth,
  );

  // Always try "latest" once as fallback seed
  const datesToFetch = [
    ...sampleDays.map(
      (day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ),
    "",
  ];

  for (const date of datesToFetch) {
    try {
      const url = date
        ? `https://api.bnm.gov.my/public/exchange-rate?date=${date}`
        : `https://api.bnm.gov.my/public/exchange-rate`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.BNM.API.v1+json",
          "User-Agent": "cffk-fx-sync/1.0",
        },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { data?: BnmRateRow[] };
      for (const item of body.data ?? []) {
        const code = (item.currency_code || "").toUpperCase();
        if (!currencies.has(code)) continue;
        const perUnit = rateToMyrPerUnit(item);
        if (perUnit == null || perUnit <= 0) continue;
        const bucket = sums[code] ?? { total: 0, n: 0 };
        bucket.total += perUnit;
        bucket.n += 1;
        sums[code] = bucket;
      }
    } catch {
      /* skip */
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
