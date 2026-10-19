import { and, desc, eq } from "drizzle-orm";
import { order, productSku, productV2, auditLog } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin } from "@/server/telefunc-context";
import { createSupplierOrder } from "@/server/supplier/purchase";
import { processSupplierOrder } from "@/server/supplier/process";
import { deliverPaidOrder } from "@/server/order/service";
import { generateOrderNo } from "@/server/order/order-number";
import { notifyOrderEmailEvents } from "@/server/email/order-events";
import { writeAuditLog } from "./audit";
import { allocateInvoiceNo } from "./invoice";
import { ledgerToCsv, listLedgerRows } from "./ledger";

export const onListAccountingLedger = telefuncAction(async (input?: {
  startDate?: string;
  endDate?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}) => {
  const { database } = requireAdmin();
  const start = input?.startDate ? new Date(input.startDate) : undefined;
  const end = input?.endDate ? new Date(input.endDate) : undefined;
  if (start && Number.isNaN(start.getTime())) appError("DATE_INVALID");
  if (end && Number.isNaN(end.getTime())) appError("DATE_INVALID");
  return listLedgerRows(database, {
    start,
    end,
    query: input?.query,
    page: input?.page,
    pageSize: input?.pageSize,
  });
});

export const onExportAccountingCsv = telefuncAction(async (input?: {
  startDate?: string;
  endDate?: string;
  query?: string;
}) => {
  const { database } = requireAdmin();
  const start = input?.startDate ? new Date(input.startDate) : undefined;
  const end = input?.endDate ? new Date(input.endDate) : undefined;
  const { rows } = await listLedgerRows(database, {
    start,
    end,
    query: input?.query,
    page: 1,
    pageSize: 10_000,
  });
  return { csv: ledgerToCsv(rows), rowCount: rows.length };
});

export const onListAuditLogs = telefuncAction(async (input?: { page?: number; pageSize?: number; entityType?: string }) => {
  const { db } = requireAdmin();
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input?.pageSize ?? 20));
  const conditions = [];
  if (input?.entityType) conditions.push(eq(auditLog.entityType, input.entityType));
  const where = conditions.length ? and(...conditions) : undefined;
  const items = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { items, page, pageSize };
});

/** Manual bank-transfer order: fee=0, PAID, then fulfill (supplier API when SKU is SUPPLIER). */
export const onCreateManualBankOrder = telefuncAction(async (input: {
  productSkuId: number;
  quantity: number;
  customerEmail: string;
  contactValue?: string;
  note?: string;
  grossAmount?: number;
}) => {
  const { database, db, user, runtime } = requireAdmin();
  if (!input || !Number.isInteger(input.productSkuId) || input.productSkuId <= 0) appError("PRODUCT_SKU_INVALID");
  const quantity = Math.floor(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) appError("QUANTITY_INVALID");
  const email = String(input.customerEmail ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) appError("EMAIL_INVALID");

  const [sku] = await db
    .select({
      id: productSku.id,
      name: productSku.name,
      price: productSku.price,
      status: productSku.status,
      fulfillmentSource: productSku.fulfillmentSource,
      deliveryType: productSku.deliveryType,
      fixedDeliveryContent: productSku.fixedDeliveryContent,
      productId: productSku.productId,
      productName: productV2.name,
      productStatus: productV2.status,
    })
    .from(productSku)
    .innerJoin(productV2, eq(productV2.id, productSku.productId))
    .where(eq(productSku.id, input.productSkuId))
    .limit(1);
  if (!sku || sku.status !== "ACTIVE" || sku.productStatus !== "ACTIVE") appError("PRODUCT_NOT_AVAILABLE");

  const unitPrice = sku.price;
  const grossCents =
    input.grossAmount !== undefined && Number.isFinite(input.grossAmount)
      ? Math.round(input.grossAmount * 100)
      : unitPrice * quantity;
  if (grossCents < 0) appError("AMOUNT_INVALID");

  const now = new Date();
  const orderNo = generateOrderNo();
  const invoiceNo = await allocateInvoiceNo(database, now);

  const [created] = await db
    .insert(order)
    .values({
      orderNo,
      invoiceNo,
      ownerUserId: user.id,
      productId: sku.productId,
      productSkuId: sku.id,
      productNameSnapshot: sku.productName,
      productSkuNameSnapshot: sku.name,
      unitPrice,
      quantity,
      amount: grossCents,
      originalAmount: grossCents,
      contactType: "EMAIL",
      contactValue: input.contactValue?.trim() || email,
      contactEmailNormalized: email,
      buyerNote: input.note?.trim() || "MANUAL_BANK_TRANSFER",
      paymentProvider: "DIRECT_TRANSFER",
      paymentChannel: "BANK",
      paymentMethodKind: "DIRECT_TRANSFER",
      paymentFeeCents: 0,
      fulfillmentSourceSnapshot: sku.fulfillmentSource,
      deliveryTypeSnapshot: sku.deliveryType,
      fixedDeliveryContentSnapshot: sku.fixedDeliveryContent,
      status: "PAID",
      paymentStatus: "PAID",
      deliveryStatus: "NOT_DELIVERED",
      paidAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: order.id, orderNo: order.orderNo, invoiceNo: order.invoiceNo });

  if (!created) appError("ORDER_CREATE_FAILED");

  await writeAuditLog(database, {
    actorUserId: user.id,
    actorEmail: null,
    action: "MANUAL_BANK_ORDER_CREATED",
    entityType: "order",
    entityId: String(created.id),
    after: created,
    note: "Fee forced to 0; bank direct transfer",
  });

  if (sku.fulfillmentSource === "SUPPLIER") {
    const supplierTask = await createSupplierOrder(database, created.id);
    if (supplierTask?.id) {
      await processSupplierOrder(database, supplierTask.id, runtime);
    }
  } else {
    await deliverPaidOrder(database, created.id);
  }

  try {
    await notifyOrderEmailEvents(database, runtime);
  } catch {
    /* email optional */
  }

  const [final] = await db.select().from(order).where(eq(order.id, created.id)).limit(1);
  await writeAuditLog(database, {
    actorUserId: user.id,
    actorEmail: null,
    action: "MANUAL_BANK_ORDER_FULFILLED",
    entityType: "order",
    entityId: String(created.id),
    after: { status: final?.status, deliveryStatus: final?.deliveryStatus },
  });

  return {
    id: created.id,
    orderNo: created.orderNo,
    invoiceNo: created.invoiceNo,
    status: final?.status ?? "PAID",
    deliveryStatus: final?.deliveryStatus ?? "NOT_DELIVERED",
    feeAmountCents: 0,
    grossAmountCents: grossCents,
  };
});
