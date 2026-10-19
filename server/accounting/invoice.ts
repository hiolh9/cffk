import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { invoiceSequence } from "@/database/drizzle/schema";

/** Allocate sequential invoice number INV-YYYY-#### */
export async function allocateInvoiceNo(database: D1Database, at = new Date()): Promise<string> {
  const db = createDrizzleDb(database);
  const year = at.getUTCFullYear();
  const [row] = await db.select().from(invoiceSequence).where(eq(invoiceSequence.id, 1)).limit(1);
  if (!row) {
    await db.insert(invoiceSequence).values({ id: 1, year, nextValue: 2 });
    return `INV-${year}-${String(1).padStart(4, "0")}`;
  }
  if (row.year !== year) {
    await db.update(invoiceSequence).set({ year, nextValue: 2 }).where(eq(invoiceSequence.id, 1));
    return `INV-${year}-${String(1).padStart(4, "0")}`;
  }
  const current = row.nextValue;
  await db.update(invoiceSequence).set({ nextValue: current + 1 }).where(eq(invoiceSequence.id, 1));
  return `INV-${year}-${String(current).padStart(4, "0")}`;
}
