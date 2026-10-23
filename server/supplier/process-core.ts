import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, siteSetting, supplierAccount, supplierBinding, supplierOrder } from "@/database/drizzle/schema";
import { createSupplierAdapter } from "./providers/factory";
import { loadSupplierCredentials } from "./credentials";
import { enqueueOrderEvent } from "@/server/email/order-events";
import { normalizeLegacyProtocolVersion, supplierOrderStateSchema } from "./schema";
import { isSupplierAccountFailureCode } from "./error";

const RETRY_DELAY_MS = 5 * 60 * 1000;
const DEFAULT_MAX_AUTOMATIC_ATTEMPTS = 5;

async function resolveMaxAttempts(database: D1Database) {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db.select({ supplierMaxAttempts: siteSetting.supplierMaxAttempts }).from(siteSetting).where(eq(siteSetting.id, 1)).limit(1);
    const n = Number(row?.supplierMaxAttempts);
    if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_AUTOMATIC_ATTEMPTS;
    return Math.min(Math.floor(n), 50);
  } catch {
    return DEFAULT_MAX_AUTOMATIC_ATTEMPTS;
  }
}

type Runtime = Record<string, unknown>;

function errorCode(cause: unknown) {
  return typeof cause === "object" && cause && "code" in cause && typeof cause.code === "string" ? cause.code : cause instanceof Error ? cause.message : "supplier_purchase_failed";
}

function isBusinessQuoteFailure(code: string) {
  return [
    "supplier_stock_insufficient",
    "supplier_binding_cost_limit",
    "supplier_account_cost_limit",
    "supplier_balance_insufficient",
    "supplier_live_quote_exceeds_limit",
  ].includes(code);
}

function isNonNegativeMinor(value: string) {
  return /^(0|[1-9]\d*)$/.test(value);
}

async function chooseAccount(db: ReturnType<typeof createDrizzleDb>, binding: typeof supplierBinding.$inferSelect, excludedAccountId?: string | null) {
  const now = new Date();
  const candidates = await db.select().from(supplierAccount).where(and(eq(supplierAccount.provider, binding.provider), eq(supplierAccount.normalizedApiOrigin, binding.normalizedApiOrigin), eq(supplierAccount.enabled, true), or(isNull(supplierAccount.cooldownUntil), lte(supplierAccount.cooldownUntil, now)))).orderBy(asc(supplierAccount.lastSelectedAt), asc(supplierAccount.id)).limit(20);
  return candidates.find((account) => account.id !== excludedAccountId && normalizeLegacyProtocolVersion(account.provider, account.protocolVersion) === normalizeLegacyProtocolVersion(binding.provider, binding.protocolVersion)) ?? null;
}

function quote(binding: typeof supplierBinding.$inferSelect, account: typeof supplierAccount.$inferSelect, quantity: number) {
  const unitCostMinor = BigInt(binding.referenceCostMinor);
  const totalCostMinor = unitCostMinor * BigInt(quantity);
  if (binding.remoteStatus !== "active" || binding.stockQuantity < quantity) throw new Error("supplier_stock_insufficient");
  if (unitCostMinor > BigInt(binding.maxCostMinor)) throw new Error("supplier_binding_cost_limit");
  if (account.maxOrderCostMinor !== null && totalCostMinor > BigInt(account.maxOrderCostMinor)) throw new Error("supplier_account_cost_limit");
  if (account.balanceMinor === null || BigInt(account.balanceMinor) - BigInt(account.reserveBalanceMinor) < totalCostMinor) throw new Error("supplier_balance_insufficient");
  return { unitCostMinor: unitCostMinor.toString(), totalCostMinor: totalCostMinor.toString() };
}

async function markAccountSuccess(db: ReturnType<typeof createDrizzleDb>, accountId: string) {
  await db.update(supplierAccount).set({ consecutiveFailures: 0, healthStatus: "healthy", lastErrorCode: null, lastErrorAt: null, lastSelectedAt: new Date(), updatedAt: new Date() }).where(eq(supplierAccount.id, accountId));
}

async function markAccountFailure(db: ReturnType<typeof createDrizzleDb>, accountId: string, code: string) {
  const [account] = await db.select({ consecutiveFailures: supplierAccount.consecutiveFailures }).from(supplierAccount).where(eq(supplierAccount.id, accountId)).limit(1);
  const failures = (account?.consecutiveFailures ?? 0) + 1;
  await db.update(supplierAccount).set({ consecutiveFailures: failures, healthStatus: failures >= 3 ? "unhealthy" : "degraded", lastErrorCode: code, lastErrorAt: new Date(), cooldownUntil: failures >= 3 ? new Date(Date.now() + RETRY_DELAY_MS) : null, updatedAt: new Date() }).where(eq(supplierAccount.id, accountId));
}

async function failTask(db: ReturnType<typeof createDrizzleDb>, id: number, code: string, terminal: boolean) {
  await db.update(supplierOrder).set({ state: terminal ? "failed" : "uncertain", lastErrorCode: code, nextRetryAt: terminal ? null : new Date(Date.now() + RETRY_DELAY_MS), updatedAt: new Date() }).where(eq(supplierOrder.id, id));
  return { status: terminal ? "failed" as const : "uncertain" as const, errorCode: code };
}

export async function completeSupplierOrderFromCallback(database: D1Database, supplierOrderId: number, upstreamOrderId: string, cards: string[]) {
  const db = createDrizzleDb(database);
  await db.update(supplierOrder).set({ state: "supplied", upstreamOrderId, updatedAt: new Date() }).where(eq(supplierOrder.id, supplierOrderId));
  const [task] = await db.select().from(supplierOrder).where(eq(supplierOrder.id, supplierOrderId)).limit(1);
  if (task?.orderId) {
    await db.update(order).set({ status: "DELIVERED", deliveryStatus: "DELIVERED", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(order.id, task.orderId));
    await enqueueOrderEvent(database, task.orderId, "DELIVERY_SUCCESS");
  }
  return { ok: true };
}

export async function processSupplierOrder(database: D1Database, supplierOrderId: number, runtime: Runtime) {
  const db = createDrizzleDb(database);
  const [task] = await db.select().from(supplierOrder).where(eq(supplierOrder.id, supplierOrderId)).limit(1);
  if (!task) return { status: "failed" as const, errorCode: "supplier_order_not_found" };
  if (["supplied", "refunded", "failed"].includes(task.state) && task.state !== "uncertain") {
    if (task.state === "supplied") return { status: "supplied" as const };
    return { status: task.state as "failed" | "refunded" };
  }

  try {
    const { getOpsKillSwitches } = await import("@/server/ops/kill-switch");
    const switches = await getOpsKillSwitches(database);
    if (!switches.autoFulfillEnabled) {
      return { status: "pending" as const, errorCode: "auto_fulfill_paused" };
    }
  } catch {
  }

  if (task.orderId != null) {
    const [paidOrder] = await db
      .select({ paymentStatus: order.paymentStatus, status: order.status, amount: order.amount, orderNo: order.orderNo })
      .from(order)
      .where(eq(order.id, task.orderId))
      .limit(1);
    if (!paidOrder || paidOrder.paymentStatus !== "PAID") {
      return failTask(db, task.id, "order_not_paid", true);
    }
    try {
      const { getReviewOrderAmountCents } = await import("@/server/ops/risk-limits");
      const reviewCents = await getReviewOrderAmountCents(database);
      const amount = Number(paidOrder.amount ?? 0);
      if (reviewCents > 0 && Number.isFinite(amount) && amount >= reviewCents) {
        await db
          .update(supplierOrder)
          .set({
            nextRetryAt: new Date(Date.now() + 6 * 60 * 60_000),
            updatedAt: new Date(),
          })
          .where(eq(supplierOrder.id, task.id));
        try {
          const { alertManualReviewHold } = await import("@/server/ops/ops-alert");
          await alertManualReviewHold(database, {
            orderNo: String(paidOrder.orderNo ?? task.orderId),
            amountCents: amount,
            thresholdCents: reviewCents,
          });
        } catch {
          /* alert best-effort */
        }
        return { status: "pending" as const, errorCode: "manual_review_required" };
      }
    } catch {
      /* missing column before migration: continue normal fulfill */
    }
    try {
      const { getStoredUserRiskScore, getBehaviorReviewThreshold } = await import("@/server/ops/behavior-score");
      const [owner] = await db.select({ ownerUserId: order.ownerUserId }).from(order).where(eq(order.id, task.orderId)).limit(1);
      if (owner?.ownerUserId) {
        const score = await getStoredUserRiskScore(database, owner.ownerUserId);
        const thr = await getBehaviorReviewThreshold(database);
        if (thr > 0 && score >= thr) {
          await db
            .update(supplierOrder)
            .set({
              nextRetryAt: new Date(Date.now() + 6 * 60 * 60_000),
              updatedAt: new Date(),
            })
            .where(eq(supplierOrder.id, task.id));
          return { status: "pending" as const, errorCode: "behavior_review_hold" };
        }
      }
    } catch {
      /* behavior score optional */
    }
  }

  const maxAttempts = await resolveMaxAttempts(database);
  if ((task.attemptCount ?? 0) >= maxAttempts) {
    return failTask(db, task.id, "supplier_max_attempts", true);
  }

  const [binding] = await db.select().from(supplierBinding).where(eq(supplierBinding.id, task.supplierBindingId)).limit(1);
  if (!binding) return failTask(db, task.id, "supplier_binding_missing", true);
  let account = task.selectedAccountId
    ? (await db.select().from(supplierAccount).where(eq(supplierAccount.id, task.selectedAccountId)).limit(1))[0]
    : null;
  if (!account) {
    account = await chooseAccount(db, binding, null);
    if (!account) return failTask(db, task.id, "supplier_account_unavailable", false);
  }
  let adapter;
  try {
    adapter = createSupplierAdapter({
      provider: account.provider,
      protocolVersion: normalizeLegacyProtocolVersion(account.provider, account.protocolVersion),
      baseUrl: account.baseUrl,
      credentials: await loadSupplierCredentials(account.credentialsJson),
      currency: account.currency,
      currencyDecimals: account.currencyDecimals,
    });
  } catch (cause) {
    await markAccountFailure(db, account.id, errorCode(cause));
    return failTask(db, task.id, errorCode(cause), false);
  }
  try {
    const quoteResult = quote(binding, account, task.quantity);
    const requestNo = task.providerRequestNo ?? `cffk-${task.id}-${Date.now()}`;
    await db.update(supplierOrder).set({
      selectedAccountId: account.id,
      selectedCredentialsRevision: account.credentialsRevision,
      providerRequestNo: requestNo,
      quotedUnitCostMinor: quoteResult.unitCostMinor,
      totalCostMinor: quoteResult.totalCostMinor,
      state: "submitting",
      attemptCount: task.attemptCount + 1,
      updatedAt: new Date(),
    }).where(eq(supplierOrder.id, task.id));
    const result = await adapter.submitOrder({
      upstreamProductId: binding.upstreamProductId,
      upstreamSkuId: binding.upstreamSkuId,
      quantity: task.quantity,
      requestNo,
      callbackUrl: "",
      traceId: requestNo,
    });
    if (result.status === "supplied") {
      await markAccountSuccess(db, account.id);
      await db.update(supplierOrder).set({ state: "supplied", upstreamOrderId: result.upstreamOrderId, updatedAt: new Date() }).where(eq(supplierOrder.id, task.id));
      if (task.orderId) {
        await db.update(order).set({ status: "DELIVERED", deliveryStatus: "DELIVERED", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(order.id, task.orderId));
        await enqueueOrderEvent(database, task.orderId, "DELIVERY_SUCCESS");
      }
      return { status: "supplied" as const };
    }
    if (result.status === "definitively_failed") {
      await markAccountFailure(db, account.id, result.errorCode ?? "supplier_order_failed");
      return failTask(db, task.id, result.errorCode ?? "supplier_order_failed", true);
    }
    await db.update(supplierOrder).set({ state: "processing", upstreamOrderId: result.upstreamOrderId, nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS), updatedAt: new Date() }).where(eq(supplierOrder.id, task.id));
    return { status: "processing" as const };
  } catch (cause) {
    const code = errorCode(cause);
    if (isSupplierAccountFailureCode(code) || isBusinessQuoteFailure(code)) {
      await markAccountFailure(db, account.id, code);
    }
    return failTask(db, task.id, code, isBusinessQuoteFailure(code));
  }
}

export async function processPendingSupplierOrders(database: D1Database, runtime: Runtime) {
  try {
    const { getOpsKillSwitches } = await import("@/server/ops/kill-switch");
    const switches = await getOpsKillSwitches(database);
    if (!switches.autoFulfillEnabled) {
      return { processed: 0, failed: 0, paused: true as const };
    }
  } catch {
  }

  const db = createDrizzleDb(database);
  const now = new Date();
  const pending = await db.select({ id: supplierOrder.id }).from(supplierOrder).where(and(sql`${supplierOrder.state} in ('pending','processing','submitting','uncertain')`, or(isNull(supplierOrder.nextRetryAt), lte(supplierOrder.nextRetryAt, now)))).orderBy(asc(supplierOrder.id)).limit(20);
  const results = [];
  for (const row of pending) {
    try {
      results.push(await processSupplierOrder(database, row.id, runtime));
    } catch {
      results.push({ status: "failed" as const });
    }
  }
  return { processed: results.length, failed: results.filter((item) => item.status === "failed").length };
}
