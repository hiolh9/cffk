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
import { normalizeAdminContactEmail, assertAdminSupplierValidate } from "@/server/order/admin-validate";
import {
  recordPrepaymentTopup,
  recordPlatformFeeFromWallet,
  buildStatementWithOpening,
  exportMonthlySupplierCogsCsv,
  formatWalletStatementText,
} from "./supplier-wallet";
import { applyTaxNexusToPaidOrder } from "@/server/tax/apply-tax-nexus";
import { applyProductTaxCategoryToPaidOrder } from "@/server/tax/apply-tax-category";
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
  contactEmail?: string;
  amountCents?: number;
  buyerNote?: string;
  validateFields?: Record<string, string>;
  skipValidate?: boolean;
  /** 税务用：客户 IP/地区，默认 MY（后台本地单） */
  customerIpCountry?: string | null;
  cardIssuingCountry?: string | null;
}) => {
  const { database, db, user, runtime } = requireAdmin();
  if (!input?.productSkuId || !input?.quantity || input.quantity < 1) appError("ORDER_INPUT_INVALID");
  const email = normalizeAdminContactEmail(input.contactEmail);

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
      taxCategory: productV2.taxCategory,
    })
    .from(productSku)
    .innerJoin(productV2, eq(productV2.id, productSku.productId))
    .where(eq(productSku.id, input.productSkuId))
    .limit(1);
  if (!sku) appError("PRODUCT_SKU_NOT_FOUND");
  if ((sku.fulfillmentSource ?? "LOCAL") === "SUPPLIER" && input.skipValidate !== true) {
    await assertAdminSupplierValidate(database, sku.id, input.validateFields ?? {});
  }
  const unitPrice = sku.price;
  const quantity = input.quantity;
  const amount = input.amountCents ?? unitPrice * quantity;
  const orderNo = await generateOrderNo(database);
  const invoiceNo = await allocateInvoiceNo(database);
  const now = new Date();
  const productTaxCategory =
    sku.taxCategory === "Digital_Service" ? "Digital_Service" : "Digital_Goods";
  const ipCountry = (input.customerIpCountry || "MY").toUpperCase().slice(0, 2);
  const cardCountry = input.cardIssuingCountry
    ? String(input.cardIssuingCountry).toUpperCase().slice(0, 2)
    : null;
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
      productTaxCategory,
      customerIpCountry: ipCountry,
      cardIssuingCountry: cardCountry,
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
    after: { orderNo, invoiceNo, amount, email, productTaxCategory, ipCountry },
  });

  // 与前台 confirmOrderPayment 一致：先税务，再发货
  try {
    await applyTaxNexusToPaidOrder(database, created.id, {
      ipCountry,
      cardCountry,
    });
  } catch (e) {
    console.error("tax-nexus-manual", e);
  }
  try {
    await applyProductTaxCategoryToPaidOrder(database, created.id, {
      ipCountry,
      cardCountry,
    });
  } catch (e) {
    console.error("tax-category-manual", e);
  }

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


/** Record bankâ†’supplier prepaid top-up (Invoice downloaded from email by operator). */
export const onRecordSupplierTopup = telefuncAction(async (input: {
  entryDate?: string;
  amountMyr: number;
  invoiceRef: string;
  supplierKey?: string;
  description?: string;
}) => {
  const { database, user } = requireAdmin();
  if (!input?.invoiceRef?.trim()) appError("VALIDATION_FAILED");
  if (!Number.isFinite(input.amountMyr) || input.amountMyr === 0) appError("VALIDATION_FAILED");
  const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();
  if (Number.isNaN(entryDate.getTime())) appError("DATE_INVALID");
  return recordPrepaymentTopup(database, {
    entryDate,
    amountMyr: input.amountMyr,
    invoiceRef: input.invoiceRef.trim(),
    supplierKey: (input.supplierKey || "moogold").trim(),
    description: input.description,
    createdBy: user.id,
  });
});

/** Membership/platform fee deducted from prepaid wallet (operating expense, not COGS). */
export const onRecordSupplierPlatformFee = telefuncAction(async (input: {
  entryDate?: string;
  amountMyr: number;
  supplierKey?: string;
  description?: string;
}) => {
  const { database, user } = requireAdmin();
  if (!Number.isFinite(input.amountMyr) || input.amountMyr === 0) appError("VALIDATION_FAILED");
  const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();
  if (Number.isNaN(entryDate.getTime())) appError("DATE_INVALID");
  return recordPlatformFeeFromWallet(database, {
    entryDate,
    amountMyr: input.amountMyr,
    supplierKey: (input.supplierKey || "moogold").trim(),
    description: input.description,
    createdBy: user.id,
  });
});

/** Monthly wallet statement. Pass previous closing as openingBalanceMyr. */
export const onGetSupplierWalletStatement = telefuncAction(async (input: {
  yearMonth: string;
  supplierKey?: string;
  openingBalanceMyr?: number;
}) => {
  const { database } = requireAdmin();
  if (!input?.yearMonth || !/^\d{4}-\d{2}$/.test(input.yearMonth.trim())) appError("DATE_INVALID");
  const supplierKey = (input.supplierKey || "moogold").trim();
  const opening = Number.isFinite(input.openingBalanceMyr as number) ? Number(input.openingBalanceMyr) : 0;
  const stmt = await buildStatementWithOpening(database, input.yearMonth.trim(), supplierKey, opening);
  return { ...stmt, text: formatWalletStatementText(stmt) };
});

/** Monthly API COGS CSV for archive folder (LOCAL_PREPAID orders). */
export const onExportSupplierCogsCsv = telefuncAction(async (input: { yearMonth: string }) => {
  const { database } = requireAdmin();
  if (!input?.yearMonth || !/^\d{4}-\d{2}$/.test(input.yearMonth.trim())) appError("DATE_INVALID");
  const csv = await exportMonthlySupplierCogsCsv(database, input.yearMonth.trim());
  return { yearMonth: input.yearMonth.trim(), csv };
});
