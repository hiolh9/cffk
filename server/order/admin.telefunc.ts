import { telefuncAction } from "@/server/telefunc-action";
import { and, count, desc, eq, gte, like, lt } from "drizzle-orm";
import { order, orderDelivery, paymentLog } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";
import { formatCentsAsYuan } from "@/lib/payment-utils";
import { dateBoundaryInTimezone } from "@/lib/site-timezone";
import { notifyOrderEmailEvents } from "@/server/email/order-events";
import { getSiteSettings } from "@/server/site/public-settings";
import { requireAdminSecure } from "@/server/telefunc-context";
import type { AddressSnapshot } from "@/server/payment/types";
import { closePendingOrder, deliverPaidOrder } from "./service";
import { PaymentFlowService } from "@/server/payment/flow-service";
import { paymentRepository } from "@/server/payment/repository";
import { createSupplierOrder } from "@/server/supplier/purchase";
import { processSupplierOrder } from "@/server/supplier/process";

type OrderStatus = "PENDING" | "PAID" | "DELIVERED" | "CLOSED" | "FAILED";
type DeliveryStatus = "NOT_DELIVERED" | "DELIVERING" | "DELIVERED" | "FAILED";

function parseAddressSnapshot(value: string | null): AddressSnapshot | null {
  if (!value) return null;
  try {
    const snapshot = JSON.parse(value) as Partial<AddressSnapshot>;
    const fields: Array<keyof Omit<AddressSnapshot, "version" | "postalCode">> = ["recipientName", "phone", "country", "province", "city", "district", "addressLine"];
    if (snapshot.version !== 1 || fields.some((field) => typeof snapshot[field] !== "string")) return null;
    if (snapshot.postalCode !== null && typeof snapshot.postalCode !== "string") return null;
    return snapshot as AddressSnapshot;
  } catch {
    return null;
  }
}

async function internalOnGetAdminOrders(input?: { query?: string; status?: OrderStatus; deliveryStatus?: DeliveryStatus; startDate?: string; endDate?: string; page?: number; pageSize?: number }) {
  const { database, db } = await requireAdminSecure();
  const page = Math.max(1, Math.floor(input?.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Math.floor(input?.pageSize ?? 20)));
  const conditions = [];
  if (input?.query?.trim()) conditions.push(like(order.orderNo, `%${input.query.trim()}%`));
  if (input?.status) conditions.push(eq(order.status, input.status));
  if (input?.deliveryStatus) conditions.push(eq(order.deliveryStatus, input.deliveryStatus));
  if (input?.startDate || input?.endDate) {
    const timezone = (await getSiteSettings(database)).timezone;
    if (input.startDate) conditions.push(gte(order.createdAt, dateBoundaryInTimezone(input.startDate, timezone)));
    if (input.endDate) conditions.push(lt(order.createdAt, dateBoundaryInTimezone(input.endDate, timezone, true)));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const [orders, totalRows] = await Promise.all([
    db.select({ id: order.id, orderNo: order.orderNo, productName: order.productNameSnapshot, quantity: order.quantity, amount: order.amount, contactType: order.contactType, contactValue: order.contactValue, paymentProvider: order.paymentProvider, paymentChannel: order.paymentChannel, status: order.status, paymentStatus: order.paymentStatus, deliveryType: order.deliveryTypeSnapshot, deliveryStatus: order.deliveryStatus, createdAt: order.createdAt, paidAt: order.paidAt, deliveredAt: order.deliveredAt }).from(order).where(where).orderBy(desc(order.createdAt), desc(order.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(order).where(where),
  ]);
  return { orders: orders.map((record) => ({ ...record, amount: formatCentsAsYuan(record.amount) })), total: totalRows[0]?.value ?? 0, page, pageSize };
}

async function internalOnGetAdminOrderDetail(input: { orderId: number }) {
  const { db } = await requireAdminSecure();
  const [record] = await db.select().from(order).where(eq(order.id, input.orderId)).limit(1);
  if (!record) appError("ORDER_NOT_FOUND");
  const [deliveries, payments] = await Promise.all([
    db.select().from(orderDelivery).where(eq(orderDelivery.orderId, record.id)).orderBy(desc(orderDelivery.createdAt)),
    db.select({ id: paymentLog.id, eventType: paymentLog.eventType, verifyStatus: paymentLog.verifyStatus, message: paymentLog.message, createdAt: paymentLog.createdAt }).from(paymentLog).where(eq(paymentLog.orderId, record.id)).orderBy(desc(paymentLog.createdAt)),
  ]);
  const { addressSnapshotJson, ...orderRecord } = record;
  return { order: { ...orderRecord, amount: formatCentsAsYuan(record.amount), addressSnapshot: parseAddressSnapshot(addressSnapshotJson) }, deliveries, payments };
}

async function internalOnCloseAdminOrder(input: { orderId: number }) {
  const { database, db } = await requireAdminSecure();
  await closePendingOrder(database, input.orderId);
  const [record] = await db.select({ id: order.id, status: order.status }).from(order).where(eq(order.id, input.orderId)).limit(1);
  if (!record) appError("ORDER_NOT_FOUND");
  if (record.status !== "CLOSED") appError("ORDER_CANNOT_CLOSE");
  return record;
}

async function internalOnReplenishAdminOrder(input: { orderId: number }) {
  const { database, runtime, db } = await requireAdminSecure();
  if (!input || typeof input !== "object" || !Number.isInteger(input.orderId) || input.orderId <= 0) appError("ORDER_ID_INVALID");
  const [record] = await db.select({ id: order.id, orderNo: order.orderNo, status: order.status, paymentStatus: order.paymentStatus }).from(order).where(eq(order.id, input.orderId)).limit(1);
  if (!record) appError("ORDER_NOT_FOUND");
  if (record.status !== "PENDING" || record.paymentStatus !== "UNPAID") appError("ORDER_NOT_PAYABLE");
  const attempt = await paymentRepository(database).latestAttempt(record.id);
  const outcome = await new PaymentFlowService(database, runtime).confirm(record.orderNo, "ADMIN_MANUAL", undefined, attempt?.id);
  if (outcome === "NOT_PAYABLE") appError("ORDER_NOT_PAYABLE");
  if (outcome === "PAYMENT_EXCEPTION") appError("ORDER_PAYMENT_EXCEPTION");
  return { id: record.id, outcome };
}

async function internalOnRetryAutomaticDelivery(input: { orderId: number }) {
  const { database, runtime, db } = await requireAdminSecure();
  const [snapshot] = await db.select({ fulfillmentSource: order.fulfillmentSourceSnapshot }).from(order).where(eq(order.id, input.orderId)).limit(1);
  if (!snapshot) appError("ORDER_NOT_FOUND");
  if (snapshot.fulfillmentSource === "SUPPLIER") {
    const supplierTask = await createSupplierOrder(database, input.orderId);
    if (!supplierTask?.id) appError("SUPPLIER_ORDER_CREATE_FAILED");
    const result = await processSupplierOrder(database, supplierTask.id, runtime);
    if (result.status !== "supplied") appError("ORDER_DELIVERY_NOT_COMPLETED");
  } else {
    await deliverPaidOrder(database, input.orderId);
  }
  await notifyOrderEmailEvents(database, runtime);
  return { ok: true };
}

export const onGetAdminOrders = telefuncAction(internalOnGetAdminOrders);
export const onGetAdminOrderDetail = telefuncAction(internalOnGetAdminOrderDetail);
export const onCloseAdminOrder = telefuncAction(internalOnCloseAdminOrder);
export const onReplenishAdminOrder = telefuncAction(internalOnReplenishAdminOrder);
export const onRetryAutomaticDelivery = telefuncAction(internalOnRetryAutomaticDelivery);
