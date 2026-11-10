/**
 * server/tax/category-reports.ts
 */
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order } from "@/database/drizzle/schema";

function ymBounds(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

function csvEscape(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

/** MY + Digital_Service only (SST / RMCD service track) */
export async function exportSSTLocalServiceSales(database: D1Database, yearMonth: string) {
  const db = createDrizzleDb(database);
  const { from, to } = ymBounds(yearMonth);
  const rows = await db
    .select({
      orderNo: order.orderNo,
      invoiceNo: order.invoiceNo,
      paidAt: order.paidAt,
      productTaxCategory: order.productTaxCategory,
      customerIpCountry: order.customerIpCountry,
      cardIssuingCountry: order.cardIssuingCountry,
      sstApplicable: order.sstApplicable,
      sstAmountMyrCents: order.sstAmountMyrCents,
      amount: order.amount,
    })
    .from(order)
    .where(
      and(
        eq(order.productTaxCategory, "Digital_Service"),
        eq(order.taxResidencyRegion, "MY"),
        gte(order.paidAt, from),
        lt(order.paidAt, to),
      ),
    );
  const lines = ["Order_ID,Invoice,PaidAt,Product_Tax_Category,IP,BIN,SST_Applicable,SST_Cents,Gross_Cents"];
  for (const r of rows) {
    lines.push(
      [r.orderNo, r.invoiceNo, r.paidAt ? new Date(r.paidAt).toISOString() : "", r.productTaxCategory, r.customerIpCountry, r.cardIssuingCountry, r.sstApplicable ? 1 : 0, r.sstAmountMyrCents, r.amount]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** MY + Digital_Goods (separate archive; your position: not SST supply) */
export async function exportDigitalGoodsLocalSales(database: D1Database, yearMonth: string) {
  const db = createDrizzleDb(database);
  const { from, to } = ymBounds(yearMonth);
  const rows = await db
    .select({
      orderNo: order.orderNo,
      invoiceNo: order.invoiceNo,
      paidAt: order.paidAt,
      customerIpCountry: order.customerIpCountry,
      cardIssuingCountry: order.cardIssuingCountry,
      amount: order.amount,
    })
    .from(order)
    .where(
      and(
        eq(order.productTaxCategory, "Digital_Goods"),
        eq(order.taxResidencyRegion, "MY"),
        gte(order.paidAt, from),
        lt(order.paidAt, to),
      ),
    );
  const lines = ["Order_ID,Invoice,PaidAt,Product_Tax_Category,IP,BIN,Gross_Cents,Note"];
  for (const r of rows) {
    lines.push(
      [r.orderNo, r.invoiceNo, r.paidAt ? new Date(r.paidAt).toISOString() : "", "Digital_Goods", r.customerIpCountry, r.cardIssuingCountry, r.amount, "Not_SST_supply_position"]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** Non-MY residency (keep category column) */
export async function exportExportExemptAll(database: D1Database, yearMonth: string) {
  const db = createDrizzleDb(database);
  const { from, to } = ymBounds(yearMonth);
  const rows = await db
    .select({
      orderNo: order.orderNo,
      invoiceNo: order.invoiceNo,
      paidAt: order.paidAt,
      productTaxCategory: order.productTaxCategory,
      taxResidencyRegion: order.taxResidencyRegion,
      customerIpCountry: order.customerIpCountry,
      cardIssuingCountry: order.cardIssuingCountry,
      amount: order.amount,
      taxExemptReason: order.taxExemptReason,
    })
    .from(order)
    .where(and(gte(order.paidAt, from), lt(order.paidAt, to), ne(order.taxResidencyRegion, "MY")));
  const lines = ["Order_ID,Invoice,PaidAt,Product_Tax_Category,Tax_Residency,IP,BIN,Gross_Cents,Exempt_Reason"];
  for (const r of rows) {
    lines.push(
      [r.orderNo, r.invoiceNo, r.paidAt ? new Date(r.paidAt).toISOString() : "", r.productTaxCategory, r.taxResidencyRegion, r.customerIpCountry, r.cardIssuingCountry, r.amount, r.taxExemptReason]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** P&L revenue split + SST liability (not revenue) */
export async function sumMonthlyRevenueSplit(database: D1Database, yearMonth: string) {
  const db = createDrizzleDb(database);
  const { from, to } = ymBounds(yearMonth);

  const [svc] = await db
    .select({ s: sql<number>`coalesce(sum(${order.amount}), 0)` })
    .from(order)
    .where(
      and(
        gte(order.paidAt, from),
        lt(order.paidAt, to),
        eq(order.productTaxCategory, "Digital_Service"),
        eq(order.taxResidencyRegion, "MY"),
      ),
    );
  const [goods] = await db
    .select({ s: sql<number>`coalesce(sum(${order.amount}), 0)` })
    .from(order)
    .where(
      and(
        gte(order.paidAt, from),
        lt(order.paidAt, to),
        eq(order.productTaxCategory, "Digital_Goods"),
        eq(order.taxResidencyRegion, "MY"),
      ),
    );
  const [exp] = await db
    .select({ s: sql<number>`coalesce(sum(${order.amount}), 0)` })
    .from(order)
    .where(and(gte(order.paidAt, from), lt(order.paidAt, to), ne(order.taxResidencyRegion, "MY")));
  const [sst] = await db
    .select({ s: sql<number>`coalesce(sum(${order.sstAmountMyrCents}), 0)` })
    .from(order)
    .where(and(gte(order.paidAt, from), lt(order.paidAt, to), eq(order.sstApplicable, true)));

  return {
    yearMonth,
    localDigitalServiceRevenueMyr: Number(svc?.s ?? 0) / 100,
    localDigitalGoodsRevenueMyr: Number(goods?.s ?? 0) / 100,
    exportRevenueMyr: Number(exp?.s ?? 0) / 100,
    sstPayableLiabilityMyr: Number(sst?.s ?? 0) / 100,
  };
}
