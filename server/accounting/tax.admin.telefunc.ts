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
import { writeAuditLog } from "./audit";
import { createDrizzleDb } from "@/database/drizzle";

export const onTaxDashboard = telefuncAction(async () => {
  const { database } = requireAdmin();
  return listTaxTypeDashboard(database);
});

export const onListTaxTypes = telefuncAction(async () => {
  const { db } = requireAdmin();
  const items = await db.select().from(taxType).orderBy(desc(taxType.id)).limit(200);
  return { items };
});

export const onUpsertTaxType = telefuncAction(async (input: {
  id?: number;
  code: string;
  name: string;
  ratePercent: number;
  dueDays?: number;
  enabled?: boolean;
}) => {
  const { db, database, adminUserId } = await requireAdminSecure();
  const code = String(input.code || "").trim().toUpperCase();
  if (!code || !input.name?.trim()) appError("VALIDATION_FAILED");
  const rate = Number(input.ratePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) appError("VALIDATION_FAILED");
  const now = new Date();
  if (input.id) {
    await db
      .update(taxType)
      .set({
        code,
        name: input.name.trim(),
        ratePercent: rate,
        dueDays: input.dueDays ?? null,
        enabled: input.enabled !== false,
        updatedAt: now,
      })
      .where(eq(taxType.id, input.id));
  } else {
    await db.insert(taxType).values({
      code,
      name: input.name.trim(),
      ratePercent: rate,
      dueDays: input.dueDays ?? null,
      enabled: input.enabled !== false,
      createdAt: now,
      updatedAt: now,
    });
  }
  await writeAuditLog(database, {
    actorUserId: adminUserId,
    action: "TAX_TYPE_UPSERT",
    entityType: "taxType",
    entityId: code,
    after: input,
  });
  return { ok: true as const };
});

export const onGetProductTaxLinks = telefuncAction(async (input: { productId: number }) => {
  const { db } = requireAdmin();
  if (!input?.productId) appError("VALIDATION_FAILED");
  const items = await db.select().from(productTax).where(eq(productTax.productId, input.productId));
  return { items };
});

export const onSetProductTaxLinks = telefuncAction(async (input: {
  productId: number;
  taxTypeIds: number[];
}) => {
  const { database, adminUserId } = await requireAdminSecure();
  if (!input?.productId) appError("VALIDATION_FAILED");
  const db = createDrizzleDb(database);
  await db.delete(productTax).where(eq(productTax.productId, input.productId));
  const now = new Date();
  for (const taxTypeId of input.taxTypeIds || []) {
    await db.insert(productTax).values({
      productId: input.productId,
      taxTypeId,
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
});

export const onPreviewTaxAmount = telefuncAction(async (input: {
  baseMyr: number;
  ratePercent: number;
}) => {
  requireAdmin();
  return { amountMyr: calcTaxAmount(Number(input.baseMyr) || 0, Number(input.ratePercent) || 0) };
});

export const onCreateTaxBatch = telefuncAction(async (input: {
  taxTypeId: number;
  periodKey: string;
}) => {
  const { database, adminUserId } = await requireAdminSecure();
  if (!input?.taxTypeId || !input?.periodKey?.trim()) appError("VALIDATION_FAILED");
  const result = await buildDraftBatchFromObligations(database, input.taxTypeId, input.periodKey.trim());
  await writeAuditLog(database, {
    actorUserId: adminUserId,
    action: "TAX_BATCH_CREATE",
    entityType: "taxReturnBatch",
    entityId: String(result?.id ?? input.periodKey),
    after: result,
  });
  return result;
});

export const onListTaxBatches = telefuncAction(async () => {
  const { db } = requireAdmin();
  const items = await db.select().from(taxReturnBatch).orderBy(desc(taxReturnBatch.id)).limit(100);
  return { items };
});

export const onMarkTaxBatchFiled = telefuncAction(async (input: { batchId: number; filedAt?: string }) => {
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
});

export const onListOpenObligations = telefuncAction(async () => {
  const { database } = requireAdmin();
  const db = createDrizzleDb(database);
  const items = await db.select().from(taxObligation).orderBy(desc(taxObligation.id)).limit(200);
  return { items, suggestDueDateMs: suggestDueDateMs, round2 };
});
