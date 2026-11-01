import { desc, eq } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin } from "@/server/telefunc-context";
import { appError } from "@/lib/app-error";
import { taxType, productTax, taxReturnBatch, taxObligation } from "@/database/drizzle/schema-tax";
import {
  buildDraftBatchFromObligations,
  calcTaxAmount,
  listTaxTypeDashboard,
  markBatchFiled,
  round2,
  suggestDueDateMs,
} from "@/server/accounting/tax-service";
import { writeAuditLog } from "@/server/accounting/audit";

function parseYmToRange(yearMonth: string): { from: number; to: number } {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) appError("DATE_INVALID");
  const [y, m] = yearMonth.split("-").map(Number);
  const from = Date.UTC(y!, m! - 1, 1, 0, 0, 0);
  const to = Date.UTC(y!, m!, 1, 0, 0, 0);
  return { from, to };
}

/** Dashboard: tax types + open aging + suggested due + estimated tax */
export const onTaxDashboard = telefuncAction(async () => {
  const { database } = requireAdmin();
  const rows = await listTaxTypeDashboard(database);
  return { items: rows };
});

export const onListTaxTypes = telefuncAction(async () => {
  const { db } = requireAdmin();
  const items = await db.select().from(taxType).orderBy(taxType.sort, taxType.id);
  return {
    items: items.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  };
});

export const onUpsertTaxType = telefuncAction(
  async (input: {
    id?: number;
    code: string;
    name: string;
    description?: string;
    defaultRatePercent: number;
    calcBasis?: "GROSS_REVENUE" | "COGS" | "NET_PROFIT" | "MANUAL";
    cycleDays?: number;
    dueDaysAfterPeriodEnd?: number;
    reminderDaysBefore?: string;
    isActive?: boolean;
    sort?: number;
  }) => {
    const { db, database, adminUserId } = requireAdmin();
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !name) appError("VALIDATION_FAILED");
    const rate = Number(input.defaultRatePercent);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) appError("VALIDATION_FAILED");
    const now = new Date();
    if (input.id) {
      await db
        .update(taxType)
        .set({
          code,
          name,
          description: input.description?.trim() || null,
          defaultRatePercent: rate,
          calcBasis: input.calcBasis ?? "GROSS_REVENUE",
          cycleDays: input.cycleDays ?? 60,
          dueDaysAfterPeriodEnd: input.dueDaysAfterPeriodEnd ?? 30,
          reminderDaysBefore: input.reminderDaysBefore?.trim() || "14,7,3,1",
          isActive: input.isActive !== false,
          sort: input.sort ?? 0,
          updatedAt: now,
        })
        .where(eq(taxType.id, input.id));
      await writeAuditLog(database, {
        actorUserId: adminUserId,
        action: "TAX_TYPE_UPDATE",
        entityType: "tax_type",
        entityId: String(input.id),
        after: { code, name, rate },
      });
      return { id: input.id };
    }
    const [row] = await db
      .insert(taxType)
      .values({
        code,
        name,
        description: input.description?.trim() || null,
        defaultRatePercent: rate,
        calcBasis: input.calcBasis ?? "GROSS_REVENUE",
        cycleDays: input.cycleDays ?? 60,
        dueDaysAfterPeriodEnd: input.dueDaysAfterPeriodEnd ?? 30,
        reminderDaysBefore: input.reminderDaysBefore?.trim() || "14,7,3,1",
        isActive: input.isActive !== false,
        sort: input.sort ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: taxType.id });
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "TAX_TYPE_CREATE",
      entityType: "tax_type",
      entityId: String(row!.id),
      after: { code, name, rate },
    });
    return { id: row!.id };
  },
);

/** Product editor: load linked tax types */
export const onGetProductTaxLinks = telefuncAction(async (input: { productId: number }) => {
  const { db } = requireAdmin();
  if (!input.productId) appError("VALIDATION_FAILED");
  const types = await db.select().from(taxType).orderBy(taxType.sort);
  const links = await db.select().from(productTax).where(eq(productTax.productId, input.productId));
  return {
    types: types.filter((t) => t.isActive),
    links: links.map((l) => ({
      taxTypeId: l.taxTypeId,
      ratePercentOverride: l.ratePercentOverride,
      isRequired: l.isRequired,
    })),
  };
});

/** Product editor: replace product tax links */
export const onSetProductTaxLinks = telefuncAction(
  async (input: {
    productId: number;
    links: Array<{ taxTypeId: number; ratePercentOverride?: number | null }>;
  }) => {
    const { database, adminUserId } = requireAdmin();
    if (!input.productId) appError("VALIDATION_FAILED");
    await database.prepare(`DELETE FROM product_tax WHERE productId = ?`).bind(input.productId).run();
    for (const link of input.links ?? []) {
      await database
        .prepare(
          `INSERT INTO product_tax (productId, taxTypeId, ratePercentOverride, isRequired)
           VALUES (?, ?, ?, 1)`,
        )
        .bind(
          input.productId,
          link.taxTypeId,
          link.ratePercentOverride != null && Number.isFinite(link.ratePercentOverride)
            ? Number(link.ratePercentOverride)
            : null,
        )
        .run();
    }
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "PRODUCT_TAX_SET",
      entityType: "product_tax",
      entityId: String(input.productId),
      after: { links: input.links },
    });
    return { ok: true };
  },
);

/** Preview tax: base × rate% */
export const onPreviewTaxAmount = telefuncAction(
  async (input: { baseMyr: number; ratePercent: number }) => {
    requireAdmin();
    return { taxAmountMyr: calcTaxAmount(Number(input.baseMyr) || 0, Number(input.ratePercent) || 0) };
  },
);

/** Create draft batch from Open obligations in a calendar month (or custom range) */
export const onCreateTaxBatch = telefuncAction(
  async (input: {
    taxTypeId: number;
    yearMonth?: string;
    periodFromMs?: number;
    periodToMs?: number;
    ratePercent?: number;
    batchId?: string;
  }) => {
    const { database, adminUserId } = requireAdmin();
    let from = input.periodFromMs;
    let to = input.periodToMs;
    if (input.yearMonth) {
      const r = parseYmToRange(input.yearMonth);
      from = r.from;
      to = r.to;
    }
    if (from == null || to == null || to <= from) appError("DATE_INVALID");

    const [tt] = await database
      .prepare(`SELECT dueDaysAfterPeriodEnd FROM tax_type WHERE id = ?`)
      .bind(input.taxTypeId)
      .all()
      .then((r) => r.results ?? []);
    const dueDays = Number((tt as { dueDaysAfterPeriodEnd?: number } | undefined)?.dueDaysAfterPeriodEnd) || 30;
    const dueDateMs = await suggestDueDateMs(database, input.taxTypeId, dueDays);

    const batchId =
      input.batchId?.trim() ||
      `TR-${input.taxTypeId}-${new Date(from!).toISOString().slice(0, 7).replace("-", "")}-${String(Date.now()).slice(-4)}`;

    const result = await buildDraftBatchFromObligations(database, {
      batchId,
      taxTypeId: input.taxTypeId,
      periodFromMs: from!,
      periodToMs: to!,
      ratePercent: input.ratePercent,
      dueDateMs,
      actorUserId: adminUserId,
    });

    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "TAX_BATCH_CREATE",
      entityType: "tax_return_batch",
      entityId: batchId,
      after: result,
    });
    return result;
  },
);

export const onListTaxBatches = telefuncAction(async (input?: { taxTypeId?: number }) => {
  const { database } = requireAdmin();
  const rows = input?.taxTypeId
    ? await database
        .prepare(`SELECT * FROM tax_return_batch WHERE taxTypeId = ? ORDER BY periodFrom DESC LIMIT 50`)
        .bind(input.taxTypeId)
        .all()
    : await database.prepare(`SELECT * FROM tax_return_batch ORDER BY periodFrom DESC LIMIT 50`).all();
  return { items: rows.results ?? [] };
});

export const onMarkTaxBatchFiled = telefuncAction(
  async (input: { batchId: string; receiptRef?: string }) => {
    const { database, adminUserId } = requireAdmin();
    if (!input.batchId?.trim()) appError("VALIDATION_FAILED");
    await markBatchFiled(database, input.batchId.trim());
    if (input.receiptRef?.trim()) {
      await database
        .prepare(`UPDATE tax_return_batch SET receiptRef = ?, updatedAt = ? WHERE id = ?`)
        .bind(input.receiptRef.trim(), Date.now(), input.batchId.trim())
        .run();
    }
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "TAX_BATCH_FILED",
      entityType: "tax_return_batch",
      entityId: input.batchId,
      after: { receiptRef: input.receiptRef },
    });
    return { ok: true };
  },
);

export const onListOpenObligations = telefuncAction(async (input: { taxTypeId: number; limit?: number }) => {
  const { database } = requireAdmin();
  const limit = Math.min(200, Math.max(10, input.limit ?? 50));
  const rows = await database
    .prepare(
      `SELECT id, orderId, productId, transactionDate, revenueMyr, ratePercent, taxAmountMyr, status
       FROM tax_obligation
       WHERE taxTypeId = ? AND status = 'Open'
       ORDER BY transactionDate ASC
       LIMIT ?`,
    )
    .bind(input.taxTypeId, limit)
    .all();
  return { items: rows.results ?? [] };
});
