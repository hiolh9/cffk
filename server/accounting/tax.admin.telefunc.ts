import { desc, eq } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin, requireAdminSecure } from "@/server/telefunc-context";
import { appError } from "@/lib/app-error";
import { productTax, taxObligation, taxReturnBatch, taxType } from "@/database/drizzle/schema-tax";
import { writeAuditLog } from "./audit";
import {
  buildDraftBatchFromObligations,
  calcTaxAmount,
  listTaxTypeDashboard,
  markBatchFiled,
  suggestDueDateMs,
} from "./tax-service";

export const onTaxDashboard = telefuncAction(async () => {
  const { database } = requireAdmin();
  return listTaxTypeDashboard(database);
});

export const onListTaxTypes = telefuncAction(async () => {
  const { db } = requireAdmin();
  const items = await db.select().from(taxType).orderBy(desc(taxType.id)).limit(200);
  return { items };
});

export const onUpsertTaxType = telefuncAction(
  async (input: {
    id?: number;
    code: string;
    name: string;
    rateBps: number;
    jurisdiction?: string;
    dueRuleJson?: string | null;
    reminderDaysBefore?: number;
    isActive?: boolean;
  }) => {
    const { db, database, adminUserId } = await requireAdminSecure();
    const code = String(input.code || "").trim().toUpperCase().slice(0, 32);
    const name = String(input.name || "").trim().slice(0, 120);
    if (!code || !name) appError("VALIDATION_FAILED");
    const rateBps = Math.max(0, Math.min(10000, Math.floor(Number(input.rateBps) || 0)));
    const now = new Date();
    if (input.id) {
      await db
        .update(taxType)
        .set({
          code,
          name,
          rateBps,
          jurisdiction: (input.jurisdiction || "MY").slice(0, 8),
          dueRuleJson: input.dueRuleJson ?? null,
          reminderDaysBefore: input.reminderDaysBefore ?? 7,
          isActive: input.isActive !== false,
          updatedAt: now,
        })
        .where(eq(taxType.id, input.id));
      await writeAuditLog(database, {
        actorUserId: adminUserId,
        action: "TAX_TYPE_UPDATE",
        entityType: "taxType",
        entityId: String(input.id),
        after: { code, rateBps },
      });
      return { id: input.id };
    }
    const [row] = await db
      .insert(taxType)
      .values({
        code,
        name,
        rateBps,
        jurisdiction: (input.jurisdiction || "MY").slice(0, 8),
        dueRuleJson: input.dueRuleJson ?? null,
        reminderDaysBefore: input.reminderDaysBefore ?? 7,
        isActive: input.isActive !== false,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: taxType.id });
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "TAX_TYPE_CREATE",
      entityType: "taxType",
      entityId: String(row?.id),
      after: { code, rateBps },
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
  async (input: { productId: number; taxTypeIds: number[] }) => {
    const { database, adminUserId, db } = await requireAdminSecure();
    if (!input?.productId) appError("VALIDATION_FAILED");
    await db.delete(productTax).where(eq(productTax.productId, input.productId));
    const now = new Date();
    for (const taxTypeId of input.taxTypeIds || []) {
      await db.insert(productTax).values({
        productId: input.productId,
        taxTypeId: Number(taxTypeId),
        createdAt: now,
      });
    }
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "PRODUCT_TAX_LINKS",
      entityType: "productTax",
      entityId: String(input.productId),
      after: { taxTypeIds: input.taxTypeIds },
    });
    return { ok: true as const };
  },
);

export const onPreviewTaxAmount = telefuncAction(
  async (input: { baseAmountMyr: number; rateBps: number }) => {
    requireAdmin();
    return { amountMyr: calcTaxAmount(Number(input.baseAmountMyr) || 0, Number(input.rateBps) || 0) };
  },
);

export const onCreateTaxBatch = telefuncAction(
  async (input: { taxTypeId: number; periodYear: number; periodMonth: number }) => {
    const { database, adminUserId } = await requireAdminSecure();
    if (!input?.taxTypeId) appError("VALIDATION_FAILED");
    const result = await buildDraftBatchFromObligations(database, {
      taxTypeId: input.taxTypeId,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      actorUserId: adminUserId,
    });
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "TAX_BATCH_CREATE",
      entityType: "taxReturnBatch",
      entityId: String((result as { id?: number })?.id ?? ""),
      after: result,
    });
    return result;
  },
);

export const onListTaxBatches = telefuncAction(async (input?: { taxTypeId?: number }) => {
  const { db } = requireAdmin();
  const q = db.select().from(taxReturnBatch).orderBy(desc(taxReturnBatch.id)).limit(100);
  const items = input?.taxTypeId
    ? await db.select().from(taxReturnBatch).where(eq(taxReturnBatch.taxTypeId, input.taxTypeId)).orderBy(desc(taxReturnBatch.id)).limit(100)
    : await q;
  return { items };
});

export const onMarkTaxBatchFiled = telefuncAction(
  async (input: { batchId: number; filedAt?: string }) => {
    const { database, adminUserId } = await requireAdminSecure();
    if (!input?.batchId) appError("VALIDATION_FAILED");
    const filedAt = input.filedAt ? new Date(input.filedAt) : new Date();
    if (Number.isNaN(filedAt.getTime())) appError("DATE_INVALID");
    await markBatchFiled(database, input.batchId, filedAt);
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "TAX_BATCH_FILED",
      entityType: "taxReturnBatch",
      entityId: String(input.batchId),
      after: { filedAt: filedAt.toISOString() },
    });
    return { ok: true as const };
  },
);

export const onListOpenObligations = telefuncAction(async (input: { taxTypeId: number; limit?: number }) => {
  const { db } = requireAdmin();
  if (!input?.taxTypeId) appError("VALIDATION_FAILED");
  const items = await db
    .select()
    .from(taxObligation)
    .where(eq(taxObligation.taxTypeId, input.taxTypeId))
    .orderBy(desc(taxObligation.id))
    .limit(Math.min(500, input.limit ?? 200));
  return { items, suggestDueDateMs: suggestDueDateMs(Date.now(), 30) };
});
