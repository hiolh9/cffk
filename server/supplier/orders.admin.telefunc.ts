import { and, count, desc, eq, like } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdminSecure } from "@/server/telefunc-context";
import { appError } from "@/lib/app-error";
import { supplierBinding, supplierOrder, order } from "@/database/drizzle/schema";
import { processSupplierOrder } from "./process";
import { supplierOrderActionSchema, supplierOrderListQuerySchema } from "./schema";

export const onListSupplierOrders = telefuncAction(async (input: unknown = {}) => {
  const { db } = await requireAdminSecure();
  const parsed = supplierOrderListQuerySchema.safeParse(input);
  if (!parsed.success) appError("SUPPLIER_ORDER_INPUT_INVALID");
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 20;
  const conditions = [];
  if (parsed.data.state) conditions.push(eq(supplierOrder.state, parsed.data.state));
  if (parsed.data.search?.trim()) conditions.push(like(order.orderNo, `%${parsed.data.search.trim()}%`));
  const where = conditions.length ? and(...conditions) : undefined;
  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: supplierOrder.id,
        orderId: supplierOrder.orderId,
        orderNo: order.orderNo,
        state: supplierOrder.state,
        provider: supplierOrder.provider,
        totalCostMinor: supplierOrder.totalCostMinor,
        upstreamOrderId: supplierOrder.upstreamOrderId,
        lastErrorCode: supplierOrder.lastErrorCode,
        createdAt: supplierOrder.createdAt,
        updatedAt: supplierOrder.updatedAt,
      })
      .from(supplierOrder)
      .leftJoin(order, eq(order.id, supplierOrder.orderId))
      .where(where)
      .orderBy(desc(supplierOrder.createdAt), desc(supplierOrder.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(supplierOrder).where(where),
  ]);
  return { items, total: totalRows[0]?.value ?? 0, page, pageSize };
});

export const onRetrySupplierOrder = telefuncAction(async (input: unknown) => {
  const parsed = supplierOrderActionSchema.safeParse(input);
  if (!parsed.success) appError("SUPPLIER_ORDER_INPUT_INVALID");
  const id = parsed.data.id;
  const { database, db, runtime } = await requireAdminSecure();
  const [task] = await db.select({ id: supplierOrder.id, state: supplierOrder.state }).from(supplierOrder).where(eq(supplierOrder.id, id)).limit(1);
  if (!task) appError("SUPPLIER_ORDER_NOT_FOUND");
  if (["supplied", "refunded"].includes(task.state)) appError("SUPPLIER_ORDER_ALREADY_FINISHED");
  await db.update(supplierOrder).set({ nextRetryAt: new Date(), updatedAt: new Date() }).where(eq(supplierOrder.id, task.id));
  return processSupplierOrder(database, task.id, runtime);
});

export const onReconcileSupplierOrder = telefuncAction(async (input: unknown) => {
  const parsed = supplierOrderActionSchema.safeParse(input);
  if (!parsed.success) appError("SUPPLIER_ORDER_INPUT_INVALID");
  const id = parsed.data.id;
  const { database, db, runtime } = await requireAdminSecure();
  const [task] = await db.select({ id: supplierOrder.id }).from(supplierOrder).where(eq(supplierOrder.id, id)).limit(1);
  if (!task) appError("SUPPLIER_ORDER_NOT_FOUND");
  return processSupplierOrder(database, task.id, runtime);
});

export const onReselectSupplierOrderAccount = telefuncAction(async (input: unknown) => {
  const parsed = supplierOrderActionSchema.safeParse(input);
  if (!parsed.success) appError("SUPPLIER_ORDER_INPUT_INVALID");
  const id = parsed.data.id;
  const { db } = await requireAdminSecure();
  const [task] = await db.select({ id: supplierOrder.id, state: supplierOrder.state }).from(supplierOrder).where(eq(supplierOrder.id, id)).limit(1);
  if (!task) appError("SUPPLIER_ORDER_NOT_FOUND");
  if (["supplied", "refunded"].includes(task.state)) appError("SUPPLIER_ORDER_ALREADY_FINISHED");
  await db.update(supplierOrder).set({ selectedAccountId: null, nextRetryAt: new Date(), updatedAt: new Date() }).where(eq(supplierOrder.id, task.id));
  return { id: task.id, reselected: true };
});
