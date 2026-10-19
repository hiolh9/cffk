import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { invoiceSequence } from "@/database/drizzle/schema";

/** Fixed width for the sequential part: INV-2026-000001 … INV-2026-999999 */
const INVOICE_SEQ_DIGITS = 6;

function formatInvoiceNo(year: number, seq: number) {
  return `INV-${year}-${String(seq).padStart(INVOICE_SEQ_DIGITS, "0")}`;
}

/** Allocate sequential invoice number INV-YYYY-###### (6-digit, zero-padded). */
export async function allocateInvoiceNo(database: D1Database, at = new Date()): Promise<string> {
  const db = createDrizzleDb(database);
  const year = at.getUTCFullYear();
  const [row] = await db.select().from(invoiceSequence).where(eq(invoiceSequence.id, 1)).limit(1);
  if (!row) {
    await db.insert(invoiceSequence).values({ id: 1, year, nextValue: 2 });
    return formatInvoiceNo(year, 1);
  }
  if (row.year !== year) {
    await db.update(invoiceSequence).set({ year, nextValue: 2 }).where(eq(invoiceSequence.id, 1));
    return formatInvoiceNo(year, 1);
  }
  const current = row.nextValue;
  await db.update(invoiceSequence).set({ nextValue: current + 1 }).where(eq(invoiceSequence.id, 1));
  return formatInvoiceNo(year, current);
}
