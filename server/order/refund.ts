import { eq } from "drizzle-orm";
import { order } from "@/database/drizzle/schema";
import { acctSale } from "@/database/drizzle/schema-settlement";
import { createDrizzleDb } from "@/database/drizzle";
import { appError } from "@/lib/app-error";
import { markAcctSaleRefundOrVoid } from "@/server/accounting/settlement";
import { writeAuditLog } from "@/server/accounting/audit";

export async function refundAdminOrder(
  database: D1Database,
  input: {
    orderId: number;
    type?: "REFUND" | "VOID";
    refundAmountMajor?: number;
    bankImpactMyr?: number;
    reason?: string;
    skipAccounting?: boolean;
    adminUserId: string;
  },
) {
  const db = createDrizzleDb(database);
  if (!Number.isInteger(input.orderId) || input.orderId <= 0) appError("ORDER_ID_INVALID");
  const [record] = await db.select().from(order).where(eq(order.id, input.orderId)).limit(1);
  if (!record) appError("ORDER_NOT_FOUND");
  if (record.paymentStatus !== "PAID" && record.paymentStatus !== "PARTIAL_REFUNDED") {
    appError("ORDER_NOT_PAID");
  }

  const currency = (record.currency || "MYR").toUpperCase();
  const totalMajor = currency === "JPY" ? Number(record.amount) : Number(record.amount) / 100;
  const alreadyMajor =
    currency === "JPY" ? Number(record.refundAmountCents ?? 0) : Number(record.refundAmountCents ?? 0) / 100;
  const remaining = Math.max(0, totalMajor - alreadyMajor);
  const refundMajor =
    input.refundAmountMajor != null && Number.isFinite(Number(input.refundAmountMajor))
      ? Number(input.refundAmountMajor)
      : remaining;
  if (refundMajor <= 0 || refundMajor > remaining + 1e-6) appError("ACCT_REFUND_AMOUNT_INVALID");

  const isFull = refundMajor >= remaining - 1e-6;
  const type = input.type === "VOID" ? "VOID" : "REFUND";
  const refundCents = currency === "JPY" ? Math.round(refundMajor) : Math.round(refundMajor * 100);
  const newRefundCents = Number(record.refundAmountCents ?? 0) + refundCents;
  const now = new Date();
  const paymentStatus = isFull ? "REFUNDED" : "PARTIAL_REFUNDED";

  await db
    .update(order)
    .set({
      paymentStatus,
      status: isFull ? "CLOSED" : record.status,
      refundedAt: now,
      refundAmountCents: newRefundCents,
      refundReason: (input.reason || "").trim() || record.refundReason || null,
      updatedAt: now,
    })
    .where(eq(order.id, record.id));

  let accounting: unknown = null;
  if (!input.skipAccounting) {
    const orderIdKey = (record.invoiceNo || record.orderNo || "").trim();
    if (orderIdKey) {
      try {
        const ratio = totalMajor > 0 ? refundMajor / totalMajor : 1;
        const [sale] = await db.select().from(acctSale).where(eq(acctSale.orderId, orderIdKey)).limit(1);
        let revenueReversalMyr: number | undefined;
        if (sale) {
          const already = Number(sale.refundMyr ?? 0);
          const remRev = Math.max(0, Number(sale.revenueMyr) - already);
          revenueReversalMyr = isFull
            ? remRev
            : Math.round(Number(sale.revenueMyr) * ratio * 100) / 100;
          if (revenueReversalMyr > remRev) revenueReversalMyr = remRev;
        }
        accounting = await markAcctSaleRefundOrVoid(database, {
          orderId: orderIdKey,
          type: isFull && type === "VOID" ? "VOID" : "REFUND",
          revenueReversalMyr,
          bankImpactMyr: input.bankImpactMyr,
          note: input.reason || `order#${record.id}`,
          actorUserId: input.adminUserId,
        });
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : "";
        if (msg !== "ACCT_SALE_NOT_FOUND") console.error("order refund accounting link", msg);
      }
    }
  }

  await writeAuditLog(database, {
    actorUserId: input.adminUserId,
    action: isFull ? (type === "VOID" ? "ORDER_VOID" : "ORDER_REFUND") : "ORDER_PARTIAL_REFUND",
    entityType: "order",
    entityId: String(record.id),
    after: { paymentStatus, refundAmountCents: newRefundCents, accounting },
  });

  return {
    id: record.id,
    orderNo: record.orderNo,
    paymentStatus,
    refundAmountCents: newRefundCents,
    isFull,
  };
}
