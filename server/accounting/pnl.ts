import { and, eq, gte, lt, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import {
  acctGeneralLedger,
  acctPnLSnapshot,
  acctSale,
  acctSettlement,
} from "@/database/drizzle/schema-settlement";
import { round2 } from "./fx";

export type GlType =
  | "Owner_Drawing"
  | "Capital_Injection"
  | "Expense"
  | "Prepayment"
  | "Asset_Transfer";

function monthBoundsKL(yearMonth: string): { from: Date; to: Date } {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error("YEAR_MONTH_INVALID");
  // Use calendar month in UTC aligned to KL civil month labels (YYYY-MM)
  const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { from, to };
}

export type MonthlyPnL = {
  yearMonth: string;
  salesRevenueMyr: number;
  cogsMyr: number;
  grossProfitMyr: number;
  gatewayFeesMyr: number;
  operatingExpensesMyr: number;
  /** Expense lines from GL only (tax-deductible), absolute MYR */
  glExpensesMyr: number;
  realisedFxGainLossMyr: number;
  netProfitMyr: number;
  excluded: {
    ownerDrawingsMyr: number;
    prepaymentsMyr: number;
    capitalInjectionMyr: number;
    assetTransferMyr: number;
  };
};

/**
 * Monthly P&L (LHDN-oriented):
 * Revenue / COGS from Success acctSale in month
 * OpEx = tax-deductible GL Expense + settlement gateway fees
 * FX = sum realisedFx on settlements in month
 * Owner drawings & prepayments never enter P&L
 */
export async function computeMonthlyPnL(database: D1Database, yearMonth: string): Promise<MonthlyPnL> {
  const db = createDrizzleDb(database);
  const { from, to } = monthBoundsKL(yearMonth);

  const sales = await db
    .select({
      revenue: sql<number>`coalesce(sum(${acctSale.revenueMyr}), 0)`,
      cogs: sql<number>`coalesce(sum(${acctSale.cogsMyr}), 0)`,
    })
    .from(acctSale)
    .where(
      and(
        eq(acctSale.status, "Success"),
        gte(acctSale.transactionDate, from),
        lt(acctSale.transactionDate, to),
      ),
    );

  const salesRevenueMyr = round2(Number(sales[0]?.revenue ?? 0));
  const cogsMyr = round2(Number(sales[0]?.cogs ?? 0));
  const grossProfitMyr = round2(salesRevenueMyr - cogsMyr);

  const settlements = await db
    .select({
      fees: sql<number>`coalesce(sum(${acctSettlement.gatewayFeeMyr}), 0)`,
      fx: sql<number>`coalesce(sum(${acctSettlement.realisedFxGainLoss}), 0)`,
    })
    .from(acctSettlement)
    .where(and(gte(acctSettlement.settlementDate, from), lt(acctSettlement.settlementDate, to)));

  const gatewayFeesMyr = round2(Number(settlements[0]?.fees ?? 0));
  const realisedFxGainLossMyr = round2(Number(settlements[0]?.fx ?? 0));

  const glRows = await db
    .select()
    .from(acctGeneralLedger)
    .where(and(gte(acctGeneralLedger.entryDate, from), lt(acctGeneralLedger.entryDate, to)));

  let glExpensesMyr = 0;
  let ownerDrawingsMyr = 0;
  let prepaymentsMyr = 0;
  let capitalInjectionMyr = 0;
  let assetTransferMyr = 0;

  for (const row of glRows) {
    const amt = Number(row.amountMyr);
    switch (row.type) {
      case "Expense":
        if (row.isTaxDeductible) {
          // expenses are typically negative outflow; P&L uses absolute cost
          glExpensesMyr += Math.abs(amt);
        }
        break;
      case "Owner_Drawing":
        ownerDrawingsMyr += Math.abs(amt);
        break;
      case "Prepayment":
        prepaymentsMyr += Math.abs(amt);
        break;
      case "Capital_Injection":
        capitalInjectionMyr += Math.abs(amt);
        break;
      case "Asset_Transfer":
        assetTransferMyr += Math.abs(amt);
        break;
      default:
        break;
    }
  }

  glExpensesMyr = round2(glExpensesMyr);
  const operatingExpensesMyr = round2(glExpensesMyr + gatewayFeesMyr);
  const netProfitMyr = round2(
    grossProfitMyr - operatingExpensesMyr + realisedFxGainLossMyr,
  );

  return {
    yearMonth,
    salesRevenueMyr,
    cogsMyr,
    grossProfitMyr,
    gatewayFeesMyr,
    operatingExpensesMyr,
    glExpensesMyr,
    realisedFxGainLossMyr,
    netProfitMyr,
    excluded: {
      ownerDrawingsMyr: round2(ownerDrawingsMyr),
      prepaymentsMyr: round2(prepaymentsMyr),
      capitalInjectionMyr: round2(capitalInjectionMyr),
      assetTransferMyr: round2(assetTransferMyr),
    },
  };
}

export async function savePnLSnapshot(database: D1Database, pnl: MonthlyPnL) {
  const db = createDrizzleDb(database);
  const now = new Date();
  await db
    .insert(acctPnLSnapshot)
    .values({
      yearMonth: pnl.yearMonth,
      salesRevenueMyr: pnl.salesRevenueMyr,
      cogsMyr: pnl.cogsMyr,
      grossProfitMyr: pnl.grossProfitMyr,
      gatewayFeesMyr: pnl.gatewayFeesMyr,
      operatingExpensesMyr: pnl.operatingExpensesMyr,
      realisedFxGainLossMyr: pnl.realisedFxGainLossMyr,
      netProfitMyr: pnl.netProfitMyr,
      detailJson: JSON.stringify(pnl),
      generatedAt: now,
    })
    .onConflictDoUpdate({
      target: acctPnLSnapshot.yearMonth,
      set: {
        salesRevenueMyr: pnl.salesRevenueMyr,
        cogsMyr: pnl.cogsMyr,
        grossProfitMyr: pnl.grossProfitMyr,
        gatewayFeesMyr: pnl.gatewayFeesMyr,
        operatingExpensesMyr: pnl.operatingExpensesMyr,
        realisedFxGainLossMyr: pnl.realisedFxGainLossMyr,
        netProfitMyr: pnl.netProfitMyr,
        detailJson: JSON.stringify(pnl),
        generatedAt: now,
      },
    });
  return pnl;
}

export function pnlToCsv(pnl: MonthlyPnL): string {
  const lines = [
    "P&L Item,Amount_MYR,Source",
    `Sales Revenue,${pnl.salesRevenueMyr},acctSale Success Revenue_MYR`,
    `Less: Cost of Goods Sold,${-pnl.cogsMyr},acctSale Success COGS_MYR`,
    `Gross Profit,${pnl.grossProfitMyr},Revenue - COGS`,
    `Less: Gateway Fees,${-pnl.gatewayFeesMyr},acctSettlement Gateway_Fee_MYR`,
    `Less: Operating Expenses (GL),${-pnl.glExpensesMyr},acctGeneralLedger Expense tax-deductible`,
    `Add/Less: Realised FX Gain/Loss,${pnl.realisedFxGainLossMyr},acctSettlement Realised_FX`,
    `Net Profit,${pnl.netProfitMyr},Form B figure`,
    "",
    "Excluded from P&L,Amount_MYR,Note",
    `Owner Drawings,${-pnl.excluded.ownerDrawingsMyr},Not deductible`,
    `Prepayments,${-pnl.excluded.prepaymentsMyr},Asset not expense`,
    `Capital Injection,${pnl.excluded.capitalInjectionMyr},Equity`,
    `Asset Transfer,${pnl.excluded.assetTransferMyr},Balance sheet only`,
  ];
  return lines.join("\n");
}

export async function createGlEntry(
  database: D1Database,
  input: {
    entryId?: string;
    entryDateMs: number;
    type: GlType;
    description: string;
    amountMyr: number;
    isTaxDeductible?: boolean;
    actorUserId?: string | null;
  },
) {
  const db = createDrizzleDb(database);
  const type = input.type;
  const allowed: GlType[] = [
    "Owner_Drawing",
    "Capital_Injection",
    "Expense",
    "Prepayment",
    "Asset_Transfer",
  ];
  if (!allowed.includes(type)) throw new Error("GL_TYPE_INVALID");
  const desc = input.description.trim();
  if (!desc) throw new Error("GL_DESCRIPTION_REQUIRED");
  if (!Number.isFinite(input.amountMyr) || input.amountMyr === 0) throw new Error("GL_AMOUNT_INVALID");

  // Defaults: Expense deductible; Owner_Drawing / Prepayment not
  let deductible = Boolean(input.isTaxDeductible);
  if (input.isTaxDeductible === undefined) {
    deductible = type === "Expense";
  }
  if (type === "Owner_Drawing" || type === "Prepayment") deductible = false;

  const d = new Date(input.entryDateMs);
  const entryId =
    input.entryId?.trim()
    || `GL-${d.toISOString().slice(0, 7).replace("-", "")}-${String(Date.now()).slice(-4)}`;

  const now = new Date();
  await db.insert(acctGeneralLedger).values({
    entryId,
    entryDate: d,
    type,
    description: desc,
    amountMyr: round2(input.amountMyr),
    isTaxDeductible: deductible,
    createdAt: now,
    createdBy: input.actorUserId ?? null,
    updatedAt: now,
  });
  return { entryId, type, amountMyr: round2(input.amountMyr), isTaxDeductible: deductible };
}
