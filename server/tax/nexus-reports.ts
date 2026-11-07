/**
 * server/tax/nexus-reports.ts
 */
import { and, eq, gte, lt, ne, or, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order } from "@/database/drizzle/schema";

function ymBounds(yearMonth: string): { from: Date; to: Date } {
  const [y, m] = yearMonth.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, m - 1, 1)),
    to: new Date(Date.UTC(y, m, 1)),
  };
}

export async function exportMyLocalSalesCsv(database: D1Database, yearMonth: string): Promise<string> {
  const db = createDrizzleDb(database);
  const { from, to } = ymBounds(yearMonth);
  const rows = await db
    .select({
      orderNo: order.orderNo,
      invoiceNo: order.invoiceNo,
      paidAt: order.paidAt,
      taxResidencyRegion: order.taxResidencyRegion,
      customerIpCountry: order.customerIpCountry,
      cardIssuingCountry: order.cardIssuingCountry,
      taxType: order.taxType,
      amount: order.amount,
      localTax: order.localTaxCollectedMyrCents,
    })
    .from(order)
    .where(and(eq(order.taxResidencyRegion, "MY"), gte(order.paidAt, from), lt(order.paidAt, to)));

  const lines = ["Order_ID,Invoice,PaidAt,IP_Country,Card_Country,Tax_Type,Gross_Cents,Local_Tax_Cents"];
  for (const r of rows) {
    lines.push(
      [r.orderNo, r.invoiceNo || "", r.paidAt ? new Date(r.paidAt).toISOString() : "", r.customerIpCountry || "", r.cardIssuingCountry || "", r.taxType || "", String(r.amount ?? 0), String(r.localTax ?? 0)]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(","),
    );
  }
  return lines.join("\n");
}

export async function exportExemptOrdersCsv(database: D1Database, yearMonth: string): Promise<string> {
  const db = createDrizzleDb(database);
  const { from, to } = ymBounds(yearMonth);
  const rows = await db
    .select({
      orderNo: order.orderNo,
      invoiceNo: order.invoiceNo,
      paidAt: order.paidAt,
      taxResidencyRegion: order.taxResidencyRegion,
      customerIpCountry: order.customerIpCountry,
      cardIssuingCountry: order.cardIssuingCountry,
      taxType: order.taxType,
      taxExemptReason: order.taxExemptReason,
      amount: order.amount,
    })
    .from(order)
    .where(
      and(
        gte(order.paidAt, from),
        lt(order.paidAt, to),
        or(eq(order.taxType, "Export_Exempt"), ne(order.taxResidencyRegion, "MY")),
      ),
    );

  const lines = ["Order_ID,Invoice,PaidAt,IP_Country,Card_Country,Tax_Residency,Tax_Type,Exempted_Reason,Gross_Cents"];
  for (const r of rows) {
    const reason = r.taxExemptReason || (r.taxResidencyRegion && r.taxResidencyRegion !== "MY" ? "Exported_Services" : "");
    lines.push(
      [r.orderNo, r.invoiceNo || "", r.paidAt ? new Date(r.paidAt).toISOString() : "", r.customerIpCountry || "", r.cardIssuingCountry || "", r.taxResidencyRegion || "", r.taxType || "", reason, String(r.amount ?? 0)]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(","),
    );
  }
  return lines.join("\n");
}

export async function rolling12mByRegion(database: D1Database, asOf = new Date()) {
  const db = createDrizzleDb(database);
  const from = new Date(asOf);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  const rows = await db
    .select({
      region: order.taxResidencyRegion,
      sumAmount: sql<number>`coalesce(sum(${order.amount}), 0)`,
      cnt: sql<number>`count(*)`,
    })
    .from(order)
    .where(and(gte(order.paidAt, from), lt(order.paidAt, asOf)))
    .groupBy(order.taxResidencyRegion);

  return rows.map((r) => ({
    region: r.region || "UNKNOWN",
    grossMyrApprox: Number(r.sumAmount) / 100,
    orderCount: Number(r.cnt),
  }));
}
