import { and, eq, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { acctSale } from "@/database/drizzle/schema-settlement";

/** Month-end: Success sales with zero COGS (possible missing cost entry). */
export async function listZeroCogsSuccessSales(database: D1Database, yearMonth: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!m) throw new Error("YEAR_MONTH_INVALID");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const from = new Date(Date.UTC(y, mo - 1, 1));
  const to = new Date(Date.UTC(y, mo, 1));
  const db = createDrizzleDb(database);
  const rows = await db
    .select({
      orderId: acctSale.orderId,
      transactionDate: acctSale.transactionDate,
      productDesc: acctSale.productDesc,
      revenueMyr: acctSale.revenueMyr,
      cogsMyr: acctSale.cogsMyr,
      originalCurrency: acctSale.originalCurrency,
      originalAmount: acctSale.originalAmount,
    })
    .from(acctSale)
    .where(
      and(
        eq(acctSale.status, "Success"),
        sql`${acctSale.transactionDate} >= ${from}`,
        sql`${acctSale.transactionDate} < ${to}`,
        sql`(${acctSale.cogsMyr} IS NULL OR ${acctSale.cogsMyr} = 0)`,
      ),
    )
    .orderBy(acctSale.transactionDate);
  return rows;
}
