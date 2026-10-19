import { and, desc, eq } from "drizzle-orm";
import { order, productSku, productV2 } from "@/database/drizzle/schema";
import { auditLog } from "@/database/drizzle/schema-accounting";
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
    start: start && !Number.isNaN(start.getTime()) ? start : undefined,
    end: end && !Number.isNaN(end.getTime()) ? end : undefined,
    query: input?.query,
    page: 1,
    pageSize: 50_000,
  });
  return { csv: ledgerToCsv(rows), rowCount: rows.length };
});

export const onListAuditLog = telefuncAction(async (input?: {
  entityType?: string;
  page?: number;
  pageSize?: number;
}) => {
  const { db } = requireAdmin();
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input?.pageSize ?? 30));
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

export const onCreateManualBankOrder = telefuncAction(async (input: {
  productSkuId: number;
  quantity: number;
  contactEmail: string;
  amountCents?: number;
  buyerNote?: string;
}) => {
  const { database, db, user, runtime } = requireAdmin();
  if (!input?.productSkuId || !input?.quantity || input.quantity < 1) appError("ORDER_INPUT_INVALID");
  const email = input.contactEmail?.trim().toLowerCase();
  if (!email || !email.includes("@")) appError("EMAIL_INVALID");

  const [sku] = await db
    .select({
      id: productSku.id,
      productId: productSku.productId,
      name: productSku.name,
      price: productSku.price,
      deliveryType: productSku.deliveryType,
      fulfillmentSource: productSku.fulfillmentSource,
      fixedDeliveryContent: productSku.fixedDeliveryContent,
      productName: productV2.name,
    })
    .from(productSku)
    .innerJoin(productV2, eq(productV2.id, productSku.productId))
    .where(eq(productSku.id, input.productSkuId))
    .limit(1);
  if (!sku) appError("PRODUCT_SKU_NOT_FOUND");

  const unitPrice = sku.price;
  const quantity = input.quantity;
  const amount = input.amountCents ?? unitPrice * quantity;
  const orderNo = await generateOrderNo(database);
  const invoiceNo = await allocateInvoiceNo(database);
  const now = new Date();

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
      amount,
      contactType: "EMAIL",
      contactValue: email,
      contactEmailNormalized: email,
      buyerNote: input.buyerNote ?? null,
      paymentProvider: "MANUAL_BANK",
      paymentChannel: "DIRECT_TRANSFER",
      paymentMethodKind: "DIRECT_TRANSFER",
      paymentFeeCents: 0,
      fulfillmentSourceSnapshot: sku.fulfillmentSource ?? "LOCAL",
      deliveryTypeSnapshot: sku.deliveryType,
      fixedDeliveryContentSnapshot: sku.fixedDeliveryContent,
      status: "PAID",
      paymentStatus: "PAID",
      deliveryStatus: "NOT_DELIVERED",
      paidAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) appError("ORDER_CREATE_FAILED");

  await writeAuditLog(database, {
    actorUserId: user.id,
    action: "MANUAL_BANK_ORDER_CREATED",
    entityType: "order",
    entityId: String(created.id),
    after: { orderNo, invoiceNo, amount, email },
  });

  try {
    if ((sku.fulfillmentSource ?? "LOCAL") === "SUPPLIER") {
      const supplierTask = await createSupplierOrder(database, created.id);
      if (supplierTask?.id) await processSupplierOrder(database, supplierTask.id, runtime);
    } else {
      await deliverPaidOrder(database, created.id, runtime);
    }
  } catch (cause) {
    console.error("manual bank fulfill", cause);
  }

  try {
    await notifyOrderEmailEvents(database, created.id, "PAID");
  } catch {
    /* non-fatal */
  }

  return { orderId: created.id, orderNo: created.orderNo, invoiceNo: created.invoiceNo };
});
