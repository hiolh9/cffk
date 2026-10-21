import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, supplierAccount, supplierOrder } from "@/database/drizzle/schema";

export type CogsSource = "LOCAL_PREPAID" | "CROSS_BORDER" | "LOCAL_STOCK";

export type LedgerRow = {
  orderId: number;
  orderNo: string;
  invoiceNo: string | null;
  date: string;
  customerEmail: string | null;
  paymentMethod: "GATEWAY" | "DIRECT_TRANSFER";
  paymentProvider: string;
  grossAmountCents: number;
  feeAmountCents: number;
  netReceivedCents: number;
  /** Prefer order.cogsAmountMyrCents; fallback supplier total when unset */
  cogsCostCents: number;
  cogsSource: CogsSource | null;
  cogsOriginalCurrency: "MYR" | "CNY" | null;
  cogsOriginalAmountMinor: string | null;
  exchangeRateUsed: string | null;
  fxDifferenceCents: number;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
};

function iso(d: Date) {
  return d.toISOString();
}

function normalizeCurrency(value: string | null | undefined): "MYR" | "CNY" | null {
  if (!value) return null;
  const u = value.trim().toUpperCase();
  if (u === "MYR" || u === "RM") return "MYR";
  if (u === "CNY" || u === "RMB" || u === "CNH") return "CNY";
  return null;
}

function classifyCogsSource(currency: "MYR" | "CNY" | null, fulfillment: string | null): CogsSource | null {
  if (currency === "MYR") return "LOCAL_PREPAID";
  if (currency === "CNY") return "CROSS_BORDER";
  if (fulfillment === "LOCAL") return "LOCAL_STOCK";
  return null;
}

/** Build accounting ledger rows from orders + supplier costs (MYR cents). */
export async function listLedgerRows(
  database: D1Database,
  input: { start?: Date; end?: Date; page?: number; pageSize?: number; query?: string },
): Promise<{ rows: LedgerRow[]; total: number }> {
  const db = createDrizzleDb(database);
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, input.pageSize ?? 50));
  const conditions = [];
  if (input.start) conditions.push(gte(order.createdAt, input.start));
  if (input.end) conditions.push(lt(order.createdAt, input.end));
  if (input.query?.trim()) {
    const q = `%${input.query.trim()}%`;
    conditions.push(
      sql`(${order.orderNo} LIKE ${q} OR ${order.invoiceNo} LIKE ${q} OR ${order.contactEmailNormalized} LIKE ${q} OR ${order.contactValue} LIKE ${q})`,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db.select({ total: sql<number>`count(*)` }).from(order).where(where);
  const total = Number(countRow?.total ?? 0);

  const records = await db
    .select({
      id: order.id,
      orderNo: order.orderNo,
      invoiceNo: order.invoiceNo,
      createdAt: order.createdAt,
      contactEmailNormalized: order.contactEmailNormalized,
      contactValue: order.contactValue,
      paymentMethodKind: order.paymentMethodKind,
      paymentProvider: order.paymentProvider,
      amount: order.amount,
      originalAmount: order.originalAmount,
      paymentFeeCents: order.paymentFeeCents,
      status: order.status,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      fulfillmentSourceSnapshot: order.fulfillmentSourceSnapshot,
      cogsSource: order.cogsSource,
      cogsAmountMyrCents: order.cogsAmountMyrCents,
      cogsOriginalCurrency: order.cogsOriginalCurrency,
      cogsOriginalAmountMinor: order.cogsOriginalAmountMinor,
      exchangeRateUsed: order.exchangeRateUsed,
      fxDifferenceCents: order.fxDifferenceCents,
    })
    .from(order)
    .where(where)
    .orderBy(desc(order.createdAt), desc(order.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const orderIds = records.map((r) => r.id);
  /** Fallback COGS from supplier when order fields not yet written */
  const supplierFallback = new Map<
    number,
    { totalCostMinor: number; currency: "MYR" | "CNY" | null }
  >();
  if (orderIds.length) {
    const costs = await db
      .select({
        orderId: supplierOrder.orderId,
        totalCostMinor: supplierOrder.totalCostMinor,
        selectedAccountId: supplierOrder.selectedAccountId,
      })
      .from(supplierOrder)
      .where(inArray(supplierOrder.orderId, orderIds));

    const accountIds = [
      ...new Set(costs.map((c) => c.selectedAccountId).filter((id): id is string => Boolean(id))),
    ];
    const currencyByAccount = new Map<string, "MYR" | "CNY" | null>();
    if (accountIds.length) {
      const accounts = await db
        .select({ id: supplierAccount.id, currency: supplierAccount.currency })
        .from(supplierAccount)
        .where(inArray(supplierAccount.id, accountIds));
      for (const a of accounts) currencyByAccount.set(a.id, normalizeCurrency(a.currency));
    }

    for (const row of costs) {
      if (row.orderId == null) continue;
      const n = Number(row.totalCostMinor);
      if (!Number.isFinite(n)) continue;
      const currency = row.selectedAccountId
        ? (currencyByAccount.get(row.selectedAccountId) ?? null)
        : null;
      supplierFallback.set(row.orderId, { totalCostMinor: Math.trunc(n), currency });
    }
  }

  const rows: LedgerRow[] = records.map((r) => {
    const gross = r.originalAmount ?? r.amount;
    const fee = r.paymentFeeCents ?? 0;
    const method = (r.paymentMethodKind === "DIRECT_TRANSFER" ? "DIRECT_TRANSFER" : "GATEWAY") as LedgerRow["paymentMethod"];
    const fallback = supplierFallback.get(r.id);

    let cogsSource = (r.cogsSource as CogsSource | null) ?? null;
    let cogsOriginalCurrency = (r.cogsOriginalCurrency as "MYR" | "CNY" | null) ?? null;
    let cogsOriginalAmountMinor = r.cogsOriginalAmountMinor ?? null;
    let cogsCostCents = r.cogsAmountMyrCents ?? 0;
    let fxDifferenceCents = r.fxDifferenceCents ?? 0;
    let exchangeRateUsed = r.exchangeRateUsed ?? null;

    if (!cogsSource && fallback) {
      cogsSource = classifyCogsSource(fallback.currency, r.fulfillmentSourceSnapshot);
      cogsOriginalCurrency = fallback.currency;
      cogsOriginalAmountMinor = String(fallback.totalCostMinor);
      // MYR supplier: cost is already MYR sen. CNY: leave MYR COGS 0 until bank/FX filled.
      if (fallback.currency === "MYR") cogsCostCents = fallback.totalCostMinor;
    } else if (!cogsSource && r.fulfillmentSourceSnapshot === "LOCAL") {
      cogsSource = "LOCAL_STOCK";
      cogsOriginalCurrency = "MYR";
    }

    if (cogsCostCents === 0 && fallback?.currency === "MYR") {
      cogsCostCents = fallback.totalCostMinor;
    }

    return {
      orderId: r.id,
      orderNo: r.orderNo,
      invoiceNo: r.invoiceNo ?? null,
      date: iso(r.createdAt),
      customerEmail: r.contactEmailNormalized ?? r.contactValue ?? null,
      paymentMethod: method,
      paymentProvider: r.paymentProvider,
      grossAmountCents: gross,
      feeAmountCents: method === "DIRECT_TRANSFER" ? 0 : fee,
      netReceivedCents: gross - (method === "DIRECT_TRANSFER" ? 0 : fee),
      cogsCostCents,
      cogsSource,
      cogsOriginalCurrency,
      cogsOriginalAmountMinor,
      exchangeRateUsed,
      fxDifferenceCents,
      status: r.status,
      paymentStatus: r.paymentStatus,
      deliveryStatus: r.deliveryStatus,
    };
  });

  return { rows, total };
}

export function ledgerToCsv(rows: LedgerRow[]): string {
  const header = [
    "Order_ID",
    "Invoice_No",
    "Date",
    "Customer_Email",
    "Payment_Method",
    "Payment_Provider",
    "Gross_Amount",
    "Fee_Amount",
    "Net_Received",
    "COGS_Source",
    "COGS_Amount_MYR",
    "COGS_Original_Currency",
    "COGS_Original_Amount",
    "Exchange_Rate_Used",
    "FX_Difference_MYR",
    "Status",
    "Payment_Status",
    "Delivery_Status",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csv(r.orderNo),
        csv(r.invoiceNo ?? ""),
        csv(r.date),
        csv(r.customerEmail ?? ""),
        csv(r.paymentMethod),
        csv(r.paymentProvider),
        (r.grossAmountCents / 100).toFixed(2),
        (r.feeAmountCents / 100).toFixed(2),
        (r.netReceivedCents / 100).toFixed(2),
        csv(r.cogsSource ?? ""),
        (r.cogsCostCents / 100).toFixed(2),
        csv(r.cogsOriginalCurrency ?? ""),
        csv(r.cogsOriginalAmountMinor ?? ""),
        csv(r.exchangeRateUsed ?? ""),
        (r.fxDifferenceCents / 100).toFixed(2),
        csv(r.status),
        csv(r.paymentStatus),
        csv(r.deliveryStatus),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function csv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
