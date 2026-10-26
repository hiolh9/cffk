import { desc } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin } from "@/server/telefunc-context";
import { appError } from "@/lib/app-error";
import { acctGeneralLedger } from "@/database/drizzle/schema-settlement";
import {
  computeMonthlyPnL,
  createGlEntry,
  pnlToCsv,
  savePnLSnapshot,
  type GlType,
} from "./pnl";
import { writeAuditLog } from "./audit";

export const onListGlEntries = telefuncAction(async () => {
  const { db } = requireAdmin();
  const items = await db.select().from(acctGeneralLedger).orderBy(desc(acctGeneralLedger.entryDate)).limit(200);
  return {
    items: items.map((r) => ({
      entryId: r.entryId,
      entryDate: r.entryDate.toISOString(),
      type: r.type,
      description: r.description,
      amountMyr: r.amountMyr,
      isTaxDeductible: r.isTaxDeductible,
    })),
  };
});

export const onCreateGlEntry = telefuncAction(async (input: {
  entryDate: string;
  type: GlType;
  description: string;
  amountMyr: number;
  isTaxDeductible?: boolean;
}) => {
  const { database, adminUserId } = requireAdmin();
  const d = new Date(input.entryDate);
  if (Number.isNaN(d.getTime())) appError("DATE_INVALID");
  try {
    const result = await createGlEntry(database, {
      entryDateMs: d.getTime(),
      type: input.type,
      description: input.description,
      amountMyr: Number(input.amountMyr),
      isTaxDeductible: input.isTaxDeductible,
      actorUserId: adminUserId,
    });
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "GL_ENTRY_CREATE",
      entityType: "acctGeneralLedger",
      entityId: result.entryId,
      after: result,
    });
    return result;
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : "";
    if (msg.startsWith("GL_")) appError(msg as never);
    throw cause;
  }
});

export const onGenerateMonthlyPnL = telefuncAction(async (input: { yearMonth: string; save?: boolean }) => {
  const { database, adminUserId } = requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(input.yearMonth)) appError("DATE_INVALID");
  const pnl = await computeMonthlyPnL(database, input.yearMonth);
  if (input.save !== false) {
    await savePnLSnapshot(database, pnl);
    await writeAuditLog(database, {
      actorUserId: adminUserId,
      action: "PNL_SNAPSHOT",
      entityType: "acctPnLSnapshot",
      entityId: input.yearMonth,
      after: pnl,
    });
  }
  return { pnl, csv: pnlToCsv(pnl) };
});
