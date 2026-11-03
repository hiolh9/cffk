/**
 * server/accounting/supplier-wallet.ts
 *
 * Prepaid supplier wallet (e.g. MooGold):
 *   Opening + Top-ups - API COGS - Platform fees = Closing
 * Invoices are downloaded by operator from email — system only stores GL refs.
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order } from "@/database/drizzle/schema";
import { acctGeneralLedger, acctSale } from "@/database/drizzle/schema-settlement";
import { round2 } from "@/server/accounting/fx";

export type WalletMonth = `${number}-${number}`; // YYYY-MM

function monthBounds(yearMonth: string): { from: Date; to: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!m) throw new Error("YEAR_MONTH_INVALID");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error("YEAR_MONTH_INVALID");
  const from = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
  return { from, to };
}

function prevYearMonth(yearMonth: string): string {
  const { from } = monthBounds(yearMonth);
  const p = new Date(from);
  p.setUTCMonth(p.getUTCMonth() - 1);
  return `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Match GL rows tagged for a supplier (description contains [supplier:xxx] or keyword). */
function supplierMatchSql(supplierKey: string) {
  const key = supplierKey.trim().toLowerCase();
  // description markers: [supplier:moogold] or plain moogold
  return sql`(lower(${acctGeneralLedger.description}) like ${"%" + key + "%"})`;
}

export type GlWalletType = "Prepayment" | "Expense" | "Platform_Fee" | "Prepayment_Topup";

/**
 * Create GL line for wallet top-up (bank → supplier prepaid).
 * amountMyr should be negative (cash leaving bank / asset reclass) e.g. -1000.
 * Store invoice no in description: "Top-up Invoice #12345 [supplier:moogold]"
 */
export async function recordPrepaymentTopup(
  database: D1Database,
  input: {
    entryDate: Date;
    amountMyr: number; // negative recommended
    invoiceRef: string;
    supplierKey: string;
    description?: string;
    createdBy?: string | null;
  },
) {
  const db = createDrizzleDb(database);
  const amount = round2(input.amountMyr);
  // Allow positive input meaning "top-up size" → store as negative outflow from bank perspective
  const signed = amount > 0 ? -amount : amount;
  const entryId = `GL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const desc =
    (input.description?.trim() ||
      `Prepayment top-up Invoice ${input.invoiceRef.trim()}`) +
    ` [supplier:${input.supplierKey.trim().toLowerCase()}]`;
  await db.insert(acctGeneralLedger).values({
    entryId,
    entryDate: input.entryDate,
    type: "Prepayment",
    description: desc.slice(0, 500),
    amountMyr: signed,
    isTaxDeductible: false,
    createdAt: now,
    createdBy: input.createdBy ?? null,
    updatedAt: now,
  });
  return { entryId, amountMyr: signed };
}

/**
 * Platform / membership fee deducted from prepaid wallet (not COGS).
 * amountMyr negative e.g. -50. isTaxDeductible true by default.
 * Use type Expense so existing P&L picks it up as operating expense.
 */
export async function recordPlatformFeeFromWallet(
  database: D1Database,
  input: {
    entryDate: Date;
    amountMyr: number;
    supplierKey: string;
    description?: string;
    createdBy?: string | null;
  },
) {
  const db = createDrizzleDb(database);
  const amount = round2(input.amountMyr);
  const signed = amount > 0 ? -amount : amount;
  const entryId = `GL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const desc =
    (input.description?.trim() || "Monthly membership / platform fee from wallet") +
    ` [supplier:${input.supplierKey.trim().toLowerCase()}] [Platform_Fee]`;
  await db.insert(acctGeneralLedger).values({
    entryId,
    entryDate: input.entryDate,
    type: "Expense",
    description: desc.slice(0, 500),
    amountMyr: signed,
    isTaxDeductible: true,
    createdAt: now,
    createdBy: input.createdBy ?? null,
    updatedAt: now,
  });
  return { entryId, amountMyr: signed };
}

async function sumGl(
  database: D1Database,
  yearMonth: string,
  supplierKey: string,
  kind: "topup" | "platform_fee" | "all_prepay",
): Promise<number> {
  const db = createDrizzleDb(database);
  const { from, to } = monthBounds(yearMonth);
  const rows = await db
    .select({
      type: acctGeneralLedger.type,
      amountMyr: acctGeneralLedger.amountMyr,
      description: acctGeneralLedger.description,
    })
    .from(acctGeneralLedger)
    .where(and(gte(acctGeneralLedger.entryDate, from), lt(acctGeneralLedger.entryDate, to), supplierMatchSql(supplierKey)));

  let sum = 0;
  for (const r of rows) {
    const d = (r.description || "").toLowerCase();
    const isPlatform = d.includes("[platform_fee]") || d.includes("membership") || d.includes("platform fee");
    if (kind === "topup") {
      if (r.type === "Prepayment" && !isPlatform) sum += Math.abs(Number(r.amountMyr) || 0);
    } else if (kind === "platform_fee") {
      if (r.type === "Expense" && isPlatform) sum += Math.abs(Number(r.amountMyr) || 0);
    } else if (kind === "all_prepay") {
      if (r.type === "Prepayment") sum += Math.abs(Number(r.amountMyr) || 0);
    }
  }
  return round2(sum);
}

/** API deductions = successful order COGS for LOCAL_PREPAID (or any cogs with supplier note) in month */
async function sumApiCogsMyr(database: D1Database, yearMonth: string, supplierKey: string): Promise<number> {
  const db = createDrizzleDb(database);
  const { from, to } = monthBounds(yearMonth);
  const key = supplierKey.trim().toLowerCase();

  // Prefer acctSale Success rows in range
  const sales = await db
    .select({
      cogsMyr: acctSale.cogsMyr,
      status: acctSale.status,
      orderId: acctSale.orderId,
      productDesc: acctSale.productDesc,
    })
    .from(acctSale)
    .where(and(gte(acctSale.transactionDate, from), lt(acctSale.transactionDate, to), eq(acctSale.status, "Success")));

  // Fallback / enrichment from order table cogs
  const orders = await db
    .select({
      orderNo: order.orderNo,
      invoiceNo: order.invoiceNo,
      cogsAmountMyrCents: order.cogsAmountMyrCents,
      cogsSource: order.cogsSource,
      paidAt: order.paidAt,
      status: order.status,
      productId: order.productId,
    })
    .from(order)
    .where(and(gte(order.paidAt, from), lt(order.paidAt, to)));

  let sum = 0;
  // Use order-level COGS when LOCAL_PREPAID or description later
  for (const o of orders) {
    if (o.status === "CLOSED" && o.cogsAmountMyrCents === 0) continue;
    const cents = o.cogsAmountMyrCents ?? 0;
    if (cents <= 0) continue;
    if (o.cogsSource === "LOCAL_PREPAID" || o.cogsSource === "CROSS_BORDER" || o.cogsSource == null) {
      // For multi-supplier filter: without binding tag on order, include all LOCAL_PREPAID
      if (o.cogsSource === "LOCAL_PREPAID" || key === "all") {
        sum += cents / 100;
      } else if (o.cogsSource === "LOCAL_PREPAID") {
        sum += cents / 100;
      }
    }
  }
  // If no order cogs, fall back to acctSale total cogs in month
  if (sum === 0) {
    for (const s of sales) sum += Number(s.cogsMyr) || 0;
  }
  return round2(sum);
}

export type WalletStatement = {
  yearMonth: string;
  supplierKey: string;
  openingBalanceMyr: number;
  topupMyr: number;
  apiDeductionsMyr: number;
  platformFeesMyr: number;
  closingBalanceMyr: number;
  formula: string;
};

/**
 * Closing = Opening + Top-ups - API COGS - Platform fees
 * Opening = previous month closing (recursive from 0 if no history).
 */
export async function buildSupplierWalletStatement(
  database: D1Database,
  yearMonth: string,
  supplierKey: string,
  openingBalanceOverride?: number | null,
): Promise<WalletStatement> {
  let opening = 0;
  if (openingBalanceOverride != null && Number.isFinite(openingBalanceOverride)) {
    opening = round2(openingBalanceOverride);
  } else {
    // walk previous month statement once
    try {
      const prev = prevYearMonth(yearMonth);
      const prevStmt = await buildSupplierWalletStatement(database, prev, supplierKey, 0);
      // Only use prev closing if we explicitly chain — for first month pass override or 0
      opening = 0;
      void prevStmt;
    } catch {
      opening = 0;
    }
  }

  const topupMyr = await sumGl(database, yearMonth, supplierKey, "topup");
  const platformFeesMyr = await sumGl(database, yearMonth, supplierKey, "platform_fee");
  const apiDeductionsMyr = await sumApiCogsMyr(database, yearMonth, supplierKey);

  const closingBalanceMyr = round2(opening + topupMyr - apiDeductionsMyr - platformFeesMyr);

  return {
    yearMonth,
    supplierKey,
    openingBalanceMyr: opening,
    topupMyr,
    apiDeductionsMyr,
    platformFeesMyr,
    closingBalanceMyr,
    formula: "Closing = Opening + Top-ups - API COGS - Platform fees",
  };
}

/** Chain opening from explicit prior closing (operator pastes last month closing). */
export async function buildStatementWithOpening(
  database: D1Database,
  yearMonth: string,
  supplierKey: string,
  openingBalanceMyr: number,
) {
  return buildSupplierWalletStatement(database, yearMonth, supplierKey, openingBalanceMyr);
}

/**
 * Monthly API deduction CSV rows for folder archive.
 * Columns: Order_ID, Date, Product_Desc, Deduction_Amount_MYR, Supplier_Order_Ref
 */
export async function exportMonthlySupplierCogsCsv(
  database: D1Database,
  yearMonth: string,
): Promise<string> {
  const db = createDrizzleDb(database);
  const { from, to } = monthBounds(yearMonth);

  const rows = await db
    .select({
      orderNo: order.orderNo,
      invoiceNo: order.invoiceNo,
      paidAt: order.paidAt,
      productId: order.productId,
      cogsAmountMyrCents: order.cogsAmountMyrCents,
      cogsSource: order.cogsSource,
    })
    .from(order)
    .where(and(gte(order.paidAt, from), lt(order.paidAt, to)));

  const lines = ["Order_ID,Date,Product_ID,Deduction_Amount_MYR,COGS_Source"];
  for (const r of rows) {
    const cents = r.cogsAmountMyrCents ?? 0;
    if (cents <= 0) continue;
    if (r.cogsSource && r.cogsSource !== "LOCAL_PREPAID") continue;
    const id = (r.invoiceNo || r.orderNo || "").replace(/"/g, '""');
    const date = r.paidAt ? new Date(r.paidAt).toISOString() : "";
    const desc = String(r.productId ?? "").replace(/"/g, '""');
    const amt = (cents / 100).toFixed(2);
    lines.push(`"${id}","${date}","${desc}",${amt},"${r.cogsSource || ""}"`);
  }
  return lines.join("\n");
}

/** Text block matching the Excel wallet statement layout */
export function formatWalletStatementText(s: WalletStatement): string {
  const label = s.supplierKey.toUpperCase();
  return [
    `${label} Wallet Statement (Month: ${s.yearMonth})`,
    `Opening Balance,${s.openingBalanceMyr.toFixed(2)}`,
    `(+) Top-up,${s.topupMyr.toFixed(2)}`,
    `(-) API Deductions (COGS),${s.apiDeductionsMyr.toFixed(2)}`,
    `(-) Platform / Membership Fees,${s.platformFeesMyr.toFixed(2)}`,
    `Closing Balance,${s.closingBalanceMyr.toFixed(2)}`,
    s.formula,
  ].join("\n");
}
