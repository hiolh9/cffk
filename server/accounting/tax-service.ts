/**
 * Tax center core logic (D1).
 * Amounts in MYR major units (same as acctSale.revenueMyr).
 * Positive taxAmount = amount payable to authority.
 */
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

export type TaxCalcBasis = "GROSS_REVENUE" | "COGS" | "NET_PROFIT" | "MANUAL";
export type ObligationStatus = "Open" | "Included" | "Filed" | "Waived";
export type BatchStatus = "Draft" | "Ready" | "Filed" | "Paid";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcTaxAmount(baseMyr: number, ratePercent: number): number {
  if (!Number.isFinite(baseMyr) || !Number.isFinite(ratePercent)) return 0;
  return round2((baseMyr * ratePercent) / 100);
}

/** Days since oldest Open obligation for this tax type; null if none. */
export async function daysSinceOldestOpen(
  database: D1Database,
  taxTypeId: number,
  nowMs = Date.now(),
): Promise<{ oldestAt: number | null; days: number | null; openCount: number }> {
  const row = await database
    .prepare(
      `SELECT MIN(transactionDate) AS oldestAt, COUNT(*) AS openCount
       FROM tax_obligation
       WHERE taxTypeId = ? AND status = 'Open'`,
    )
    .bind(taxTypeId)
    .first<{ oldestAt: number | null; openCount: number }>();

  const oldestAt = row?.oldestAt ?? null;
  const openCount = Number(row?.openCount ?? 0);
  if (oldestAt == null || openCount === 0) {
    return { oldestAt: null, days: null, openCount: 0 };
  }
  const days = Math.floor((nowMs - Number(oldestAt)) / (24 * 60 * 60 * 1000));
  return { oldestAt: Number(oldestAt), days, openCount };
}

/**
 * Suggested due date:
 * 1) If fixed period batch exists with dueDate → use it
 * 2) Else: oldest Open obligation date + dueDaysAfterPeriodEnd
 *    (approximates "how long since furthest unreported sale")
 */
export async function suggestDueDateMs(
  database: D1Database,
  taxTypeId: number,
  dueDaysAfterPeriodEnd: number,
  nowMs = Date.now(),
): Promise<number | null> {
  const { oldestAt } = await daysSinceOldestOpen(database, taxTypeId, nowMs);
  if (oldestAt == null) return null;
  const offset = Math.max(0, dueDaysAfterPeriodEnd) * 24 * 60 * 60 * 1000;
  return oldestAt + offset;
}

export function parseReminderDays(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return [14, 7, 3, 1];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => b - a);
}

/** Whether a reminder should fire today for a given due date. */
export function shouldRemind(dueDateMs: number, reminderDaysBefore: number[], nowMs = Date.now()): boolean {
  const dayMs = 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((dueDateMs - nowMs) / dayMs);
  if (daysLeft < 0) return true; // overdue
  return reminderDaysBefore.some((d) => d === daysLeft);
}

/**
 * Build Draft batch from all Open obligations for taxType in [fromMs, toMs).
 * ratePercent: use input or fall back per-obligation rate.
 */
export async function buildDraftBatchFromObligations(
  database: D1Database,
  input: {
    batchId: string;
    taxTypeId: number;
    periodFromMs: number;
    periodToMs: number;
    ratePercent?: number;
    dueDateMs?: number | null;
    actorUserId?: string | null;
  },
): Promise<{
  batchId: string;
  taxableBaseMyr: number;
  taxAmountMyr: number;
  ratePercentUsed: number;
  orderCount: number;
}> {
  const obs = await database
    .prepare(
      `SELECT id, orderId, revenueMyr, ratePercent, taxAmountMyr
       FROM tax_obligation
       WHERE taxTypeId = ? AND status = 'Open'
         AND transactionDate >= ? AND transactionDate < ?`,
    )
    .bind(input.taxTypeId, input.periodFromMs, input.periodToMs)
    .all<{
      id: number;
      orderId: string;
      revenueMyr: number;
      ratePercent: number;
      taxAmountMyr: number;
    }>();

  const rows = obs.results ?? [];
  const rate =
    input.ratePercent != null && Number.isFinite(input.ratePercent)
      ? Number(input.ratePercent)
      : rows[0]
        ? Number(rows[0].ratePercent)
        : 0;

  let taxableBaseMyr = 0;
  let taxAmountMyr = 0;
  for (const r of rows) {
    const base = Number(r.revenueMyr) || 0;
    taxableBaseMyr += base;
    const lineRate = input.ratePercent != null ? rate : Number(r.ratePercent) || rate;
    const lineTax = input.ratePercent != null ? calcTaxAmount(base, rate) : Number(r.taxAmountMyr) || calcTaxAmount(base, lineRate);
    taxAmountMyr += lineTax;
  }
  taxableBaseMyr = round2(taxableBaseMyr);
  taxAmountMyr = round2(taxAmountMyr);
  const now = Date.now();

  await database
    .prepare(
      `INSERT INTO tax_return_batch (
        id, taxTypeId, periodFrom, periodTo, status,
        ratePercentUsed, taxableBaseMyr, taxAmountMyr, dueDate,
        createdAt, updatedAt, createdBy
      ) VALUES (?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ratePercentUsed = excluded.ratePercentUsed,
        taxableBaseMyr = excluded.taxableBaseMyr,
        taxAmountMyr = excluded.taxAmountMyr,
        dueDate = excluded.dueDate,
        updatedAt = excluded.updatedAt`,
    )
    .bind(
      input.batchId,
      input.taxTypeId,
      input.periodFromMs,
      input.periodToMs,
      rate,
      taxableBaseMyr,
      taxAmountMyr,
      input.dueDateMs ?? null,
      now,
      now,
      input.actorUserId ?? null,
    )
    .run();

  await database.prepare(`DELETE FROM tax_return_batch_order WHERE batchId = ?`).bind(input.batchId).run();

  for (const r of rows) {
    const base = Number(r.revenueMyr) || 0;
    const lineTax =
      input.ratePercent != null ? calcTaxAmount(base, rate) : Number(r.taxAmountMyr) || calcTaxAmount(base, Number(r.ratePercent) || rate);
    await database
      .prepare(
        `INSERT INTO tax_return_batch_order (batchId, orderId, revenueMyr, cogsMyr, taxShareMyr)
         VALUES (?, ?, ?, 0, ?)`,
      )
      .bind(input.batchId, r.orderId, base, round2(lineTax))
      .run();
    await database
      .prepare(`UPDATE tax_obligation SET status = 'Included', batchId = ?, updatedAt = ? WHERE id = ?`)
      .bind(input.batchId, now, r.id)
      .run();
  }

  return {
    batchId: input.batchId,
    taxableBaseMyr,
    taxAmountMyr,
    ratePercentUsed: rate,
    orderCount: rows.length,
  };
}

/** Mark batch Filed → obligations Filed */
export async function markBatchFiled(
  database: D1Database,
  batchId: string,
  filedAtMs = Date.now(),
): Promise<void> {
  const now = Date.now();
  await database
    .prepare(`UPDATE tax_return_batch SET status = 'Filed', filedAt = ?, updatedAt = ? WHERE id = ?`)
    .bind(filedAtMs, now, batchId)
    .run();
  await database
    .prepare(`UPDATE tax_obligation SET status = 'Filed', updatedAt = ? WHERE batchId = ?`)
    .bind(now, batchId)
    .run();
}

/**
 * Create obligations for a Success sale based on product_tax.
 * Call from order success / accounting sale path.
 */
export async function createObligationsForOrder(
  database: D1Database,
  input: {
    orderId: string;
    productId: number;
    transactionDateMs: number;
    revenueMyr: number;
  },
): Promise<number> {
  const links = await database
    .prepare(
      `SELECT pt.taxTypeId,
              COALESCE(pt.ratePercentOverride, tt.defaultRatePercent) AS ratePercent,
              tt.calcBasis
       FROM product_tax pt
       JOIN tax_type tt ON tt.id = pt.taxTypeId
       WHERE pt.productId = ? AND tt.isActive = 1`,
    )
    .bind(input.productId)
    .all<{ taxTypeId: number; ratePercent: number; calcBasis: string }>();

  const now = Date.now();
  let n = 0;
  for (const link of links.results ?? []) {
    if (link.calcBasis === "MANUAL") continue;
    const rate = Number(link.ratePercent) || 0;
    const base = Number(input.revenueMyr) || 0;
    const taxAmountMyr = calcTaxAmount(base, rate);
    await database
      .prepare(
        `INSERT INTO tax_obligation (
          orderId, productId, taxTypeId, transactionDate,
          revenueMyr, ratePercent, taxAmountMyr, status, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
      )
      .bind(
        input.orderId,
        input.productId,
        link.taxTypeId,
        input.transactionDateMs,
        round2(base),
        rate,
        taxAmountMyr,
        now,
        now,
      )
      .run();
    n += 1;
  }
  return n;
}

/** Dashboard row per tax type */
export async function listTaxTypeDashboard(database: D1Database, nowMs = Date.now()) {
  const types = await database
    .prepare(
      `SELECT id, code, name, defaultRatePercent, cycleDays, dueDaysAfterPeriodEnd, reminderDaysBefore, isActive
       FROM tax_type ORDER BY sort ASC, id ASC`,
    )
    .all();

  const out = [];
  for (const t of types.results ?? []) {
    const taxTypeId = Number((t as { id: number }).id);
    const aging = await daysSinceOldestOpen(database, taxTypeId, nowMs);
    const dueDays = Number((t as { dueDaysAfterPeriodEnd: number }).dueDaysAfterPeriodEnd) || 30;
    const dueDateMs = await suggestDueDateMs(database, taxTypeId, dueDays, nowMs);
    const reminders = parseReminderDays(String((t as { reminderDaysBefore: string }).reminderDaysBefore ?? ""));
    const remind = dueDateMs != null ? shouldRemind(dueDateMs, reminders, nowMs) : false;

    const openTax = await database
      .prepare(
        `SELECT COALESCE(SUM(taxAmountMyr), 0) AS taxSum, COALESCE(SUM(revenueMyr), 0) AS baseSum
         FROM tax_obligation WHERE taxTypeId = ? AND status = 'Open'`,
      )
      .bind(taxTypeId)
      .first<{ taxSum: number; baseSum: number }>();

    out.push({
      ...t,
      openCount: aging.openCount,
      oldestOpenAt: aging.oldestAt,
      daysSinceOldestOpen: aging.days,
      suggestedDueDate: dueDateMs,
      reminderDue: remind,
      openTaxableBaseMyr: round2(Number(openTax?.baseSum ?? 0)),
      openTaxAmountMyr: round2(Number(openTax?.taxSum ?? 0)),
    });
  }
  return out;
}
