import { and, desc, gte, lt, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { auditLog } from "@/database/drizzle/schema-accounting";
import {
  acctAdjustment,
  acctGeneralLedger,
  acctPnLSnapshot,
  acctSale,
  acctSettlement,
  acctSettlementOrder,
  fxMonthlyRate,
} from "@/database/drizzle/schema-settlement";
import { computeMonthlyPnL, pnlToCsv } from "./pnl";

function monthBounds(yearMonth: string): { from: Date; to: Date } {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error("YEAR_MONTH_INVALID");
  return {
    from: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)),
    to: new Date(Date.UTC(y, m, 1, 0, 0, 0)),
  };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\n");
}

export type MonthlyExportFile = {
  filename: string;
  content: string;
  rowCount: number;
};

/** Sparkpay monthly pack: Sparkpay-{YYYY-MM}-{NN}_{table}.csv */
export async function buildMonthlyExportPack(
  database: D1Database,
  yearMonth: string,
): Promise<{ yearMonth: string; files: MonthlyExportFile[]; manifest: string }> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) throw new Error("YEAR_MONTH_INVALID");
  const db = createDrizzleDb(database);
  const { from, to } = monthBounds(yearMonth);
  const prefix = `Sparkpay-${yearMonth}`;
  const files: MonthlyExportFile[] = [];

  const sales = await db
    .select()
    .from(acctSale)
    .where(and(gte(acctSale.transactionDate, from), lt(acctSale.transactionDate, to)))
    .orderBy(acctSale.transactionDate);
  files.push({
    filename: `${prefix}-01_acct_sales.csv`,
    rowCount: sales.length,
    content: toCsv(
      [
        "Order_ID", "Transaction_Date", "Customer_ID", "Product_Desc",
        "Original_Currency", "Original_Amount", "Transaction_FX_Rate",
        "Revenue_MYR", "COGS_MYR", "Status", "Refund_MYR", "Gateway_Provider", "Gateway_Ref",
      ],
      sales.map((r) => [
        r.orderId, r.transactionDate, r.customerId, r.productDesc,
        r.originalCurrency, r.originalAmount, r.transactionFxRate,
        r.revenueMyr, r.cogsMyr, r.status, r.refundMyr, r.gatewayProvider, r.gatewayRef,
      ]),
    ),
  });

  const settlements = await db
    .select()
    .from(acctSettlement)
    .where(and(gte(acctSettlement.settlementDate, from), lt(acctSettlement.settlementDate, to)))
    .orderBy(acctSettlement.settlementDate);
  files.push({
    filename: `${prefix}-02_acct_settlements.csv`,
    rowCount: settlements.length,
    content: toCsv(
      [
        "Settlement_ID", "Settlement_Date", "Gross_Orders_MYR_Total",
        "Gateway_Fee_MYR", "Bank_Received_MYR", "Realised_FX_Gain_Loss", "Notes",
      ],
      settlements.map((r) => [
        r.settlementId, r.settlementDate, r.grossOrdersMyrTotal,
        r.gatewayFeeMyr, r.bankReceivedMyr, r.realisedFxGainLoss, r.notes,
      ]),
    ),
  });

  const settlementIds = settlements.map((s) => s.settlementId);
  let links: Array<{ settlementId: string; orderId: string }> = [];
  if (settlementIds.length) {
    const allLinks = await db.select().from(acctSettlementOrder);
    links = allLinks.filter((l) => settlementIds.includes(l.settlementId));
  }
  files.push({
    filename: `${prefix}-03_acct_settlement_orders.csv`,
    rowCount: links.length,
    content: toCsv(["Settlement_ID", "Order_ID"], links.map((l) => [l.settlementId, l.orderId])),
  });

  const adjustments = await db
    .select()
    .from(acctAdjustment)
    .where(and(gte(acctAdjustment.createdAt, from), lt(acctAdjustment.createdAt, to)))
    .orderBy(acctAdjustment.createdAt);
  files.push({
    filename: `${prefix}-04_acct_adjustments.csv`,
    rowCount: adjustments.length,
    content: toCsv(
      ["ID", "Order_ID", "Settlement_ID", "Type", "Revenue_Reversal_MYR", "Bank_Impact_MYR", "Note", "Created_At", "Created_By"],
      adjustments.map((r) => [
        r.id, r.orderId, r.settlementId, r.type, r.revenueReversalMyr, r.bankImpactMyr, r.note, r.createdAt, r.createdBy,
      ]),
    ),
  });

  const gl = await db
    .select()
    .from(acctGeneralLedger)
    .where(and(gte(acctGeneralLedger.entryDate, from), lt(acctGeneralLedger.entryDate, to)))
    .orderBy(acctGeneralLedger.entryDate);
  files.push({
    filename: `${prefix}-05_general_ledger.csv`,
    rowCount: gl.length,
    content: toCsv(
      ["Entry_ID", "Entry_Date", "Type", "Description", "Amount_MYR", "Is_Tax_Deductible", "Created_By"],
      gl.map((r) => [
        r.entryId, r.entryDate, r.type, r.description, r.amountMyr, r.isTaxDeductible ? 1 : 0, r.createdBy,
      ]),
    ),
  });

  const fx = await db.select().from(fxMonthlyRate).where(sql`${fxMonthlyRate.yearMonth} = ${yearMonth}`);
  files.push({
    filename: `${prefix}-06_fx_monthly_rates.csv`,
    rowCount: fx.length,
    content: toCsv(
      ["Month", "Currency", "Rate_To_MYR", "Source", "Fetched_At"],
      fx.map((r) => [r.yearMonth, r.currency, r.rateToMyr, r.source, r.fetchedAt]),
    ),
  });

  const audits = await db
    .select()
    .from(auditLog)
    .where(and(gte(auditLog.createdAt, from), lt(auditLog.createdAt, to)))
    .orderBy(desc(auditLog.createdAt))
    .limit(20_000);
  files.push({
    filename: `${prefix}-07_audit_logs.csv`,
    rowCount: audits.length,
    content: toCsv(
      ["Log_ID", "Action_Time", "Action_Type", "Table_Name", "Record_ID", "Old_Value", "New_Value", "User_ID", "User_Email", "Note"],
      audits.map((r) => [
        r.id, r.createdAt, r.action, r.entityType, r.entityId, r.beforeJson, r.afterJson, r.actorUserId, r.actorEmail, r.note,
      ]),
    ),
  });

  const pnl = await computeMonthlyPnL(database, yearMonth);
  files.push({
    filename: `${prefix}-08_pnl.csv`,
    rowCount: 1,
    content: pnlToCsv(pnl),
  });

  const [snap] = await db.select().from(acctPnLSnapshot).where(sql`${acctPnLSnapshot.yearMonth} = ${yearMonth}`).limit(1);

  const manifest = [
    `Sparkpay Monthly Accounting Pack`,
    `Period: ${yearMonth}`,
    `Generated_At_UTC: ${new Date().toISOString()}`,
    `Naming: Sparkpay-{YYYY-MM}-{NN}_{table}.csv`,
    ``,
    `Files:`,
    ...files.map((f) => `  ${f.filename}  rows=${f.rowCount}`),
    ``,
    `PnL_Net_Profit_MYR: ${pnl.netProfitMyr}`,
    `PnL_Snapshot_Saved: ${snap ? "yes" : "no"}`,
    ``,
    `Rules:`,
    `- Do not delete orders; change status only.`,
    `- Owner_Drawing and Prepayment never enter P&L.`,
    `- Revenue uses monthly average FX locked at transaction date.`,
    `- Realised FX uses settlement date bank receipt.`,
  ].join("\n");

  files.unshift({
    filename: `${prefix}-00_MANIFEST.txt`,
    rowCount: 0,
    content: manifest,
  });

  return { yearMonth, files, manifest };
}
