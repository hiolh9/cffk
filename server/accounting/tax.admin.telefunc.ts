import { desc, eq } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin, requireAdminSecure } from "@/server/telefunc-context";
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
    const { db, database, adminUserId } = await requireAdminSecure();
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
          cycleDays: input.cycleDays ?? 30,
          dueDaysAfterPeriodEnd: input.dueDaysAfterPeriodEnd ?? 30,
          reminderDaysBefore: input.reminderDaysBefore ?? "7,3,1",
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
        after: { code, rate },
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
        cycleDays: input.cycleDays ?? 30,
        dueDaysAfterPeriodEnd: input.dueDaysAfterPeriodEnd ?? 30,
        reminderDaysBefore: input.reminderDaysBefore ?? "7,3,1",
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
      entityId: String(row?.id),
      after: { code, rate },
    });
    return { id: row?.id };
  },
);

export const onGetProductTaxLinks = telefuncAction(async (input: { productId: number }) => {
  const { db } = requireAdmin();
  if (!input?.productId) appError("VALIDATION_FAILED");
  const items = await db.select().from(productTax).where(eq(productTax.productId, input.productId));
  return { items };
});

export const onSetProductTaxLinks = telefuncAction(
  async (input: { productId: number; taxTypeIds: number[]; rates?: Record<number, number> }) => {
    const { db, database, adminUserId } = await requireAdminSecure();
    if (!input?.productId) appError("VALIDATION_FAILED");
    await db.delete(productTax).where(eq(productTax.productId, input.productId));
    const now = new Date();
    for (const taxTypeId of input.taxTypeIds || []) {
      await db.insert(productTax).values({
        productId: input.productId,
        taxTypeId: Number(taxTypeId),
        rateOverridePercent: input.rates?.[taxTypeId] ?? null,
        createdAt: now,
      });
    }
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "PRODUCT_TAX_LINKS",
      entityType: "product_tax",
      entityId: String(input.productId),
      after: { taxTypeIds: input.taxTypeIds },
    });
    return { ok: true as const };
  },
);

export const onPreviewTaxAmount = telefuncAction(
  async (input: { baseAmountMyr: number; ratePercent: number }) => {
    requireAdmin();
    return { amountMyr: calcTaxAmount(Number(input.baseAmountMyr) || 0, Number(input.ratePercent) || 0) };
  },
);

export const onCreateTaxBatch = telefuncAction(
  async (input: {
    taxTypeId: number;
    yearMonth: string;
    ratePercent?: number;
    batchId?: string;
    dueDateMs?: number;
  }) => {
    const { database, adminUserId } = await requireAdminSecure();
    if (!input?.taxTypeId) appError("VALIDATION_FAILED");
    const { from, to } = parseYmToRange(input.yearMonth);
    const dueDateMs = input.dueDateMs ?? suggestDueDateMs(to, 30);
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
    const { database, adminUserId } = await requireAdminSecure();
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
