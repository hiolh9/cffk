import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { accountingArchive } from "@/database/drizzle/schema";
import { ledgerToCsv, listLedgerRows } from "./ledger";

/** Archive previous calendar month ledger to R2 when binding exists. */
export async function archivePreviousMonthLedger(database: D1Database, runtime: Record<string, unknown>) {
  const now = new Date();
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  const db = createDrizzleDb(database);
  const [existing] = await db.select().from(accountingArchive).where(eq(accountingArchive.period, period)).limit(1);
  if (existing?.status === "SUCCESS") return existing;

  const { rows } = await listLedgerRows(database, { start, end, page: 1, pageSize: 50_000 });
  const csv = ledgerToCsv(rows);
  let objectKey: string | null = null;
  let status: "SUCCESS" | "FAILED" = "SUCCESS";
  let errorMessage: string | null = null;

  const bucket = runtime.R2 as R2Bucket | undefined;
  if (bucket) {
    try {
      objectKey = `accounting/ledger-${period}.csv`;
      await bucket.put(objectKey, csv, { httpMetadata: { contentType: "text/csv; charset=utf-8" } });
    } catch (cause) {
      status = "FAILED";
      errorMessage = cause instanceof Error ? cause.message : "R2_PUT_FAILED";
    }
  }

  if (existing) {
    const [row] = await db
      .update(accountingArchive)
      .set({ rowCount: rows.length, objectKey, status, errorMessage, createdAt: new Date() })
      .where(eq(accountingArchive.period, period))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(accountingArchive)
    .values({
      period,
      rowCount: rows.length,
      objectKey,
      status,
      errorMessage,
      createdAt: new Date(),
    })
    .returning();
  return row;
}
