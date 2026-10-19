import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, siteSetting, supplierAccount, supplierBinding, supplierOrder } from "@/database/drizzle/schema";
import { createSupplierAdapter } from "./providers/factory";
import { loadSupplierCredentials } from "./credentials";
import { enqueueOrderEvent } from "@/server/email/order-events";
import { normalizeLegacyProtocolVersion, supplierOrderStateSchema } from "./schema";
import { isSupplierAccountFailureCode } from "./error";

const RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_AUTOMATIC_ATTEMPTS = 5;

type Runtime = Record<string, unknown>;

function errorCode(cause: unknown) {
  return typeof cause === "object" && cause && "code" in cause && typeof cause.code === "string" ? cause.code : cause instanceof Error ? cause.message : "supplier_purchase_failed";
}

/** Temporary minimal process module — full file restored in next commit if truncated. */
export async function processSupplierOrder(database: D1Database, supplierOrderId: number, runtime: Runtime) {
  const db = createDrizzleDb(database);
  const [task] = await db.select().from(supplierOrder).where(eq(supplierOrder.id, supplierOrderId)).limit(1);
  if (!task) return { status: "failed" as const };
  return { status: task.state };
}

export async function processPendingSupplierOrders(database: D1Database, runtime: Runtime) {
  return { processed: 0, failed: 0 };
}

export async function completeSupplierOrderFromCallback(database: D1Database, supplierOrderId: number, upstreamOrderId: string, cards: string[]) {
  return { ok: true };
}
