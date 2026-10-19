import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, supplierOrder } from "@/database/drizzle/schema";

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
  cogsCostCents: number;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
};

function iso(d: Date) {
  return d.toISOString();
}

/** Build accounting ledger rows from orders + supplier costs (cents). */
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
    conditions.push(sql`(${order.orderNo} LIKE ${q} OR ${order.invoiceNo} LIKE ${q} OR ${order.contactEmailNormalized} LIKE ${q} OR ${order.contactValue} LIKE ${q})`);
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
    })
    .from(order)
    .where(where)
    .orderBy(desc(order.createdAt), desc(order.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const orderIds = records.map((r) => r.id);
  const cogsMap = new Map<number, number>();
  if (orderIds.length) {
    const costs = await db
      .select({
        orderId: supplierOrder.orderId,
        totalCostMinor: supplierOrder.totalCostMinor,
      })
      .from(supplierOrder)
      .where(inArray(supplierOrder.orderId, orderIds));
    for (const row of costs) {
      const n = Number(row.totalCostMinor);
      if (Number.isFinite(n)) cogsMap.set(row.orderId, Math.trunc(n));
    }
  }

  const rows: LedgerRow[] = records.map((r) => {
    const gross = r.originalAmount ?? r.amount;
    const fee = r.paymentFeeCents ?? 0;
    const method = (r.paymentMethodKind === "DIRECT_TRANSFER" ? "DIRECT_TRANSFER" : "GATEWAY") as LedgerRow["paymentMethod"];
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
      cogsCostCents: cogsMap.get(r.id) ?? 0,
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
    "COGS_Cost",
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
        (r.cogsCostCents / 100).toFixed(2),
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
