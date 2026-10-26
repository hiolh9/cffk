import { desc } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin } from "@/server/telefunc-context";
import { appError } from "@/lib/app-error";
import { fxMonthlyRate } from "@/database/drizzle/schema-settlement";
import { createAcctSettlement, exportAcctSalesCsv, listAcctSettlements, listUnsettledAcctSales } from "./settlement";
import { syncPreviousMonthBnmRates, upsertFxRates } from "./fx";
import { writeAuditLog } from "./audit";

export const onListUnsettledAcctSales = telefuncAction(async () => {
  const { database } = requireAdmin();
  const items = await listUnsettledAcctSales(database);
  return {
    items: items.map((r) => ({
      orderId: r.orderId,
      transactionDate: r.transactionDate.toISOString(),
      originalCurrency: r.originalCurrency,
      originalAmount: r.originalAmount,
      transactionFxRate: r.transactionFxRate,
      revenueMyr: r.revenueMyr,
      cogsMyr: r.cogsMyr,
      productDesc: r.productDesc,
      gatewayProvider: r.gatewayProvider,
    })),
  };
});

export const onListAcctSettlements = telefuncAction(async () => {
  const { database } = requireAdmin();
  const items = await listAcctSettlements(database);
  return {
    items: items.map((r) => ({
      settlementId: r.settlementId,
      settlementDate: r.settlementDate.toISOString(),
      grossOrdersMyrTotal: r.grossOrdersMyrTotal,
      gatewayFeeMyr: r.gatewayFeeMyr,
      bankReceivedMyr: r.bankReceivedMyr,
      realisedFxGainLoss: r.realisedFxGainLoss,
      notes: r.notes,
    })),
  };
});

export const onCreateAcctSettlement = telefuncAction(async (input: {
  settlementDate: string;
  bankReceivedMyr: number;
  gatewayFeeMyr: number;
  orderIds: string[];
  notes?: string;
  settlementId?: string;
}) => {
  const { database, adminUserId } = requireAdmin();
  const date = new Date(input.settlementDate);
  if (Number.isNaN(date.getTime())) appError("DATE_INVALID");
  if (!Array.isArray(input.orderIds) || !input.orderIds.length) appError("SETTLEMENT_NO_ORDERS");
  try {
    const result = await createAcctSettlement(database, {
      settlementId: input.settlementId,
      settlementDateMs: date.getTime(),
      bankReceivedMyr: Number(input.bankReceivedMyr),
      gatewayFeeMyr: Number(input.gatewayFeeMyr) || 0,
      orderIds: input.orderIds,
      notes: input.notes,
    });
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "ACCT_SETTLEMENT_CREATE",
      entityType: "acctSettlement",
      entityId: result.settlementId,
      afterJson: JSON.stringify(result),
    });
    return result;
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : "";
    if (msg.startsWith("SETTLEMENT_")) appError(msg.split(":")[0] as never);
    throw cause;
  }
});

export const onExportAcctSalesCsv = telefuncAction(async (input: { startDate: string; endDate: string }) => {
  const { database } = requireAdmin();
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) appError("DATE_INVALID");
  const csv = await exportAcctSalesCsv(database, start.getTime(), end.getTime());
  return { csv };
});

export const onListFxRates = telefuncAction(async () => {
  const { db } = requireAdmin();
  const items = await db.select().from(fxMonthlyRate).orderBy(desc(fxMonthlyRate.yearMonth)).limit(200);
  return {
    items: items.map((r) => ({
      yearMonth: r.yearMonth,
      currency: r.currency,
      rateToMyr: r.rateToMyr,
      source: r.source,
      fetchedAt: r.fetchedAt.toISOString(),
    })),
  };
});

export const onUpsertFxRates = telefuncAction(async (input: {
  yearMonth: string;
  rates: Record<string, number>;
  source?: string;
}) => {
  const { database, adminUserId } = requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(input.yearMonth)) appError("DATE_INVALID");
  await upsertFxRates(database, input.yearMonth, input.rates || {}, input.source || "MANUAL");
  await writeAuditLog(database, {
    actorUserId: adminUserId,
    action: "FX_RATE_UPSERT",
    entityType: "fxMonthlyRate",
    entityId: input.yearMonth,
    afterJson: JSON.stringify(input.rates),
  });
  return { ok: true as const };
});

export const onSyncBnmFxRates = telefuncAction(async () => {
  const { database, adminUserId } = requireAdmin();
  const result = await syncPreviousMonthBnmRates(database);
  await writeAuditLog(database, {
    actorUserId: adminUserId,
    action: "FX_RATE_BNM_SYNC",
    entityType: "fxMonthlyRate",
    entityId: result.yearMonth,
    afterJson: JSON.stringify(result.rates),
  });
  return result;
});
