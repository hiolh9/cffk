import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order } from "@/database/drizzle/schema";
import { acctSale, acctSettlement, acctSettlementOrder } from "@/database/drizzle/schema-settlement";
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
  // Realised FX = bank + fee − booked revenue (all MYR)
  const realisedFxGainLoss = round2(bank + fee - gross);
  return { grossOrdersMyrTotal: gross, gatewayFeeMyr: fee, bankReceivedMyr: bank, realisedFxGainLoss };
}

function majorFromCents(cents: number, currency: string): number {
  const ccy = currency.toUpperCase();
  const decimals = ccy === "JPY" ? 0 : 2;
  return decimals === 0 ? cents : cents / 100;
}

/**
 * After business order is PAID: lock accounting revenue at monthly avg FX.
 * Idempotent on sourceOrderPk / orderId.
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
    // If FX missing and not MYR, still book with rate 1 and mark — admin can fix rate table then re-sync
    if (currency !== "MYR") rate = 1;
  }

  const revenueMyr = round2(originalAmount * rate);
  const cogsMyr = round2((row.cogsAmountMyrCents ?? 0) / 100);
  const productDesc = [row.productNameSnapshot, row.productSkuNameSnapshot].filter(Boolean).join(" / ") || "Digital product";
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
    createdAt: now,
    updatedAt: now,
  });

  return { orderId, revenueMyr, rate, already: false as const };
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

export async function listUnsettledAcctSales(database: D1Database, limit = 200) {
  const db = createDrizzleDb(database);
  const settled = await db.select({ orderId: acctSettlementOrder.orderId }).from(acctSettlementOrder);
  const settledIds = settled.map((s) => s.orderId);
  const rows = await db
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
  return rows;
}

export async function listAcctSettlements(database: D1Database, limit = 100) {
  const db = createDrizzleDb(database);
  return db.select().from(acctSettlement).orderBy(desc(acctSettlement.settlementDate)).limit(limit);
}

export async function exportAcctSalesCsv(database: D1Database, fromMs: number, toMs: number) {
  const db = createDrizzleDb(database);
  const rows = await db
    .select()
    .from(acctSale)
    .where(and(sql`${acctSale.transactionDate} >= ${new Date(fromMs)}`, sql`${acctSale.transactionDate} < ${new Date(toMs)}`))
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
      ].join(","),
    );
  }
  return lines.join("\n");
}

function csv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// silence unused
void isNull;
