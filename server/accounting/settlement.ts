import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order } from "@/database/drizzle/schema";
import {
  acctAdjustment,
  acctSale,
  acctSettlement,
  acctSettlementOrder,
} from "@/database/drizzle/schema-settlement";
import { resolveTransactionFxRate, round2 } from "./fx";

export type AcctSaleStatus = "Success" | "Refunded" | "Voided";

export function computeSettlementTotals(input: {
  revenuesMyr: number[];
  bankReceivedMyr: number;
  gatewayFeeMyr: number;
}) {
  const gross = round2(input.revenuesMyr.reduce((s, n) => s + Number(n || 0), 0));
  const fee = round2(Number(input.gatewayFeeMyr) || 0);
  const bank = round2(Number(input.bankReceivedMyr) || 0);
  if (bank < 0 || fee < 0) throw new Error("SETTLEMENT_AMOUNT_INVALID");
  const realisedFxGainLoss = round2(bank + fee - gross);
  return { grossOrdersMyrTotal: gross, gatewayFeeMyr: fee, bankReceivedMyr: bank, realisedFxGainLoss };
}

function majorFromCents(cents: number, currency: string): number {
  const ccy = currency.toUpperCase();
  const decimals = ccy === "JPY" ? 0 : 2;
  return decimals === 0 ? cents : cents / 100;
}

function csv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * After business order is PAID: lock accounting revenue at monthly avg FX.
 * Idempotent on orderId.
 */
export async function recordAcctSaleFromPaidOrder(database: D1Database, sourceOrderPk: number) {
  const db = createDrizzleDb(database);
  const [row] = await db
    .select({
      id: order.id,
      orderNo: order.orderNo,
      invoiceNo: order.invoiceNo,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      amount: order.amount,
      originalAmount: order.originalAmount,
      currency: order.currency,
      productNameSnapshot: order.productNameSnapshot,
      productSkuNameSnapshot: order.productSkuNameSnapshot,
      contactEmailNormalized: order.contactEmailNormalized,
      ownerUserId: order.ownerUserId,
      paymentProvider: order.paymentProvider,
      paymentStatus: order.paymentStatus,
      cogsAmountMyrCents: order.cogsAmountMyrCents,
    })
    .from(order)
    .where(eq(order.id, sourceOrderPk))
    .limit(1);

  if (!row || row.paymentStatus !== "PAID") return null;

  const orderId = (row.invoiceNo || row.orderNo).trim();
  if (!orderId) return null;

  const [existing] = await db.select({ orderId: acctSale.orderId }).from(acctSale).where(eq(acctSale.orderId, orderId)).limit(1);
  if (existing) return { orderId, already: true as const };

  const currency = (row.currency || "MYR").toUpperCase();
  const amountMinor = row.originalAmount ?? row.amount;
  const originalAmount = majorFromCents(amountMinor, currency);
  const txMs = (row.paidAt ?? row.createdAt).getTime();

  let rate = 1;
  try {
    const resolved = await resolveTransactionFxRate(database, currency, txMs);
    rate = resolved.rate;
  } catch {
    if (currency !== "MYR") rate = 1;
  }

  const revenueMyr = round2(originalAmount * rate);
  const cogsMyr = round2((row.cogsAmountMyrCents ?? 0) / 100);
  const productDesc =
    [row.productNameSnapshot, row.productSkuNameSnapshot].filter(Boolean).join(" / ") || "Digital product";
  const now = new Date();

  await db.insert(acctSale).values({
    orderId,
    sourceOrderPk: row.id,
    transactionDate: new Date(txMs),
    customerId: row.ownerUserId || row.contactEmailNormalized || null,
    productDesc,
    originalCurrency: currency,
    originalAmount,
    transactionFxRate: rate,
    revenueMyr,
    cogsMyr,
    status: "Success",
    gatewayProvider: row.paymentProvider,
    gatewayRef: null,
    refundMyr: 0,
    createdAt: now,
    updatedAt: now,
  });

  return { orderId, revenueMyr, rate, already: false as const };
}

/** Backfill acctSale for all PAID business orders missing a ledger row */
export async function backfillAcctSalesFromPaidOrders(database: D1Database, limit = 500) {
  const db = createDrizzleDb(database);
  const paid = await db
    .select({ id: order.id })
    .from(order)
    .where(eq(order.paymentStatus, "PAID"))
    .orderBy(desc(order.paidAt), desc(order.id))
    .limit(limit);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of paid) {
    try {
      const result = await recordAcctSaleFromPaidOrder(database, row.id);
      if (!result) failed += 1;
      else if (result.already) skipped += 1;
      else created += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: paid.length, created, skipped, failed };
}

export async function createAcctSettlement(
  database: D1Database,
  input: {
    settlementId?: string;
    settlementDateMs: number;
    bankReceivedMyr: number;
    gatewayFeeMyr: number;
    orderIds: string[];
    notes?: string | null;
  },
) {
  const db = createDrizzleDb(database);
  const orderIds = [...new Set(input.orderIds.map((id) => id.trim()).filter(Boolean))];
  if (!orderIds.length) throw new Error("SETTLEMENT_NO_ORDERS");

  const sales = await db.select().from(acctSale).where(inArray(acctSale.orderId, orderIds));
  if (sales.length !== orderIds.length) throw new Error("SETTLEMENT_ORDER_MISSING");
  for (const s of sales) {
    if (s.status !== "Success") throw new Error(`SETTLEMENT_ORDER_NOT_SUCCESS:${s.orderId}`);
  }

  const linked = await db
    .select({ orderId: acctSettlementOrder.orderId })
    .from(acctSettlementOrder)
    .where(inArray(acctSettlementOrder.orderId, orderIds));
  if (linked.length) throw new Error(`SETTLEMENT_ORDER_ALREADY_LINKED:${linked.map((l) => l.orderId).join(",")}`);

  const totals = computeSettlementTotals({
    revenuesMyr: sales.map((s) => s.revenueMyr),
    bankReceivedMyr: input.bankReceivedMyr,
    gatewayFeeMyr: input.gatewayFeeMyr,
  });

  const settlementId =
    input.settlementId?.trim()
    || `SET-${new Date(input.settlementDateMs).toISOString().slice(0, 7).replace("-", "")}-${String(Date.now()).slice(-4)}`;

  const now = new Date();
  await db.insert(acctSettlement).values({
    settlementId,
    settlementDate: new Date(input.settlementDateMs),
    grossOrdersMyrTotal: totals.grossOrdersMyrTotal,
    gatewayFeeMyr: totals.gatewayFeeMyr,
    bankReceivedMyr: totals.bankReceivedMyr,
    realisedFxGainLoss: totals.realisedFxGainLoss,
    notes: input.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });

  for (const orderId of orderIds) {
    await db.insert(acctSettlementOrder).values({ settlementId, orderId });
  }

  return { settlementId, ...totals };
}

/**
 * Refund or void an accounting sale.
 * - Not yet settled: status → Refunded/Voided; excluded from future settlements.
 * - Already settled: also write acctAdjustment (revenue reversal + optional bank outflow).
 * Never deletes historical settlement rows (audit-safe).
 */
export async function markAcctSaleRefundOrVoid(
  database: D1Database,
  input: {
    orderId: string;
    type: "REFUND" | "VOID";
    /** Defaults to full revenueMyr */
    revenueReversalMyr?: number;
    /** Cash returned to customer / clawed by gateway (MYR). Default = revenue reversal. */
    bankImpactMyr?: number;
    note?: string | null;
    actorUserId?: string | null;
  },
) {
  const db = createDrizzleDb(database);
  const orderId = input.orderId.trim();
  const [sale] = await db.select().from(acctSale).where(eq(acctSale.orderId, orderId)).limit(1);
  if (!sale) throw new Error("ACCT_SALE_NOT_FOUND");
  if (sale.status !== "Success") throw new Error("ACCT_SALE_ALREADY_CLOSED");

  const reversal = round2(
    input.revenueReversalMyr != null ? Number(input.revenueReversalMyr) : Number(sale.revenueMyr),
  );
  if (reversal < 0 || reversal > Number(sale.revenueMyr) + 0.001) throw new Error("ACCT_REFUND_AMOUNT_INVALID");

  const bankImpact = round2(
    input.bankImpactMyr != null ? Number(input.bankImpactMyr) : reversal,
  );
  if (bankImpact < 0) throw new Error("ACCT_REFUND_AMOUNT_INVALID");

  const [link] = await db
    .select()
    .from(acctSettlementOrder)
    .where(eq(acctSettlementOrder.orderId, orderId))
    .limit(1);

  const now = new Date();
  const status = input.type === "VOID" ? "Voided" : "Refunded";

  await db
    .update(acctSale)
    .set({
      status,
      refundedAt: now,
      refundMyr: reversal,
      refundNote: input.note?.trim() || null,
      updatedAt: now,
    })
    .where(eq(acctSale.orderId, orderId));

  // Always record adjustment for audit; settlementId set when already settled
  await db.insert(acctAdjustment).values({
    orderId,
    settlementId: link?.settlementId ?? null,
    type: input.type,
    revenueReversalMyr: reversal,
    bankImpactMyr: bankImpact,
    note: input.note?.trim() || null,
    createdAt: now,
    createdBy: input.actorUserId ?? null,
  });

  return {
    orderId,
    status,
    revenueReversalMyr: reversal,
    bankImpactMyr: bankImpact,
    wasSettled: Boolean(link),
    settlementId: link?.settlementId ?? null,
  };
}

export async function listUnsettledAcctSales(database: D1Database, limit = 200) {
  const db = createDrizzleDb(database);
  const settled = await db.select({ orderId: acctSettlementOrder.orderId }).from(acctSettlementOrder);
  const settledIds = settled.map((s) => s.orderId);
  return db
    .select()
    .from(acctSale)
    .where(
      and(
        eq(acctSale.status, "Success"),
        settledIds.length ? notInArray(acctSale.orderId, settledIds) : sql`1=1`,
      ),
    )
    .orderBy(desc(acctSale.transactionDate))
    .limit(limit);
}

export async function listAcctSettlements(database: D1Database, limit = 100) {
  const db = createDrizzleDb(database);
  return db.select().from(acctSettlement).orderBy(desc(acctSettlement.settlementDate)).limit(limit);
}

export async function listAcctAdjustments(database: D1Database, limit = 100) {
  const db = createDrizzleDb(database);
  return db.select().from(acctAdjustment).orderBy(desc(acctAdjustment.createdAt)).limit(limit);
}

export async function exportAcctSalesCsv(database: D1Database, fromMs: number, toMs: number) {
  const db = createDrizzleDb(database);
  const rows = await db
    .select()
    .from(acctSale)
    .where(
      and(
        sql`${acctSale.transactionDate} >= ${new Date(fromMs)}`,
        sql`${acctSale.transactionDate} < ${new Date(toMs)}`,
      ),
    )
    .orderBy(acctSale.transactionDate);

  const header = [
    "Order_ID",
    "Transaction_Date",
    "Customer_ID",
    "Product_Desc",
    "Original_Currency",
    "Original_Amount",
    "Transaction_FX_Rate",
    "Revenue_MYR",
    "COGS_MYR",
    "Status",
    "Refund_MYR",
    "Refunded_At",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csv(r.orderId),
        csv(r.transactionDate.toISOString()),
        csv(r.customerId ?? ""),
        csv(r.productDesc),
        csv(r.originalCurrency),
        String(r.originalAmount),
        String(r.transactionFxRate),
        String(r.revenueMyr),
        String(r.cogsMyr),
        csv(r.status),
        String(r.refundMyr ?? 0),
        csv(r.refundedAt ? r.refundedAt.toISOString() : ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export async function exportAcctSettlementsCsv(database: D1Database, fromMs: number, toMs: number) {
  const db = createDrizzleDb(database);
  const rows = await db
    .select()
    .from(acctSettlement)
    .where(
      and(
        sql`${acctSettlement.settlementDate} >= ${new Date(fromMs)}`,
        sql`${acctSettlement.settlementDate} < ${new Date(toMs)}`,
      ),
    )
    .orderBy(acctSettlement.settlementDate);

  const header = [
    "Settlement_ID",
    "Settlement_Date",
    "Gross_Orders_MYR_Total",
    "Gateway_Fee_MYR",
    "Bank_Received_MYR",
    "Realised_FX_Gain_Loss",
    "Notes",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csv(r.settlementId),
        csv(r.settlementDate.toISOString().slice(0, 10)),
        String(r.grossOrdersMyrTotal),
        String(r.gatewayFeeMyr),
        String(r.bankReceivedMyr),
        String(r.realisedFxGainLoss),
        csv(r.notes ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export async function exportAcctAdjustmentsCsv(database: D1Database, fromMs: number, toMs: number) {
  const db = createDrizzleDb(database);
  const rows = await db
    .select()
    .from(acctAdjustment)
    .where(
      and(
        sql`${acctAdjustment.createdAt} >= ${new Date(fromMs)}`,
        sql`${acctAdjustment.createdAt} < ${new Date(toMs)}`,
      ),
    )
    .orderBy(acctAdjustment.createdAt);

  const header = [
    "ID",
    "Order_ID",
    "Settlement_ID",
    "Type",
    "Revenue_Reversal_MYR",
    "Bank_Impact_MYR",
    "Note",
    "Created_At",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        String(r.id),
        csv(r.orderId),
        csv(r.settlementId ?? ""),
        csv(r.type),
        String(r.revenueReversalMyr),
        String(r.bankImpactMyr),
        csv(r.note ?? ""),
        csv(r.createdAt.toISOString()),
      ].join(","),
    );
  }
  return lines.join("\n");
}
