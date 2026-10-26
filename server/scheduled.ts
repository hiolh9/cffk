import { reportUnexpectedServerError } from "./error-handling";
import { retryDuePushes } from "./push/service";
import { closeExpiredPendingOrders, processPendingAutomaticDeliveries } from "./order/service";
import { processOrderEvents } from "./email/order-events";
import { recordScheduledMaintenanceFailure } from "./scheduled-task-log";
import { reconcilePendingAlipayPayments } from "./payment/reconciliation-service";
import { processPendingSupplierOrders } from "./supplier/process";
import { getOpsKillSwitches } from "./ops/kill-switch";
import { runOpsHealthAlerts } from "./ops/ops-alert";
import { runSupplierMaintenance } from "./supplier/maintenance";
import { syncPreviousMonthBnmRates } from "./accounting/fx";

export const ORDER_PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;

export async function runScheduledMaintenance(database: D1Database, runtime: Record<string, unknown>, now = new Date()) {
  const startedAt = now;
  const runFiveMinuteMaintenance = now.getUTCMinutes() % 5 === 0;
  let reconciliation: Awaited<ReturnType<typeof reconcilePendingAlipayPayments>> | null = null;
  let orderCleanup: Awaited<ReturnType<typeof closeExpiredPendingOrders>> | null = null;
  let automaticDelivery: Awaited<ReturnType<typeof processPendingAutomaticDeliveries>> | null = null;
  let orderEvents: Awaited<ReturnType<typeof processOrderEvents>> | null = null;
  let pushRetry: Awaited<ReturnType<typeof retryDuePushes>> | null = null;
  let supplierOrders: Awaited<ReturnType<typeof processPendingSupplierOrders>> | null = null;
  let supplierMaintenance: Awaited<ReturnType<typeof runSupplierMaintenance>> | null = null;
  let fxSync: Awaited<ReturnType<typeof syncPreviousMonthBnmRates>> | null = null;
  const failures: string[] = [];
  let attemptedTasks = 0;
  let failedTasks = 0;

  if (runFiveMinuteMaintenance) {
    attemptedTasks += 1;
    try {
      reconciliation = await reconcilePendingAlipayPayments(database, runtime);
      if (reconciliation.failed > 0) failures.push(`支付主动查询失败: ${reconciliation.failed}`);
    } catch (cause) {
      failedTasks += 1;
      failures.push(`支付主动查询: ${errorMessage(cause)}`);
      reportUnexpectedServerError("scheduled-payment-reconciliation", cause);
    }

    const cutoff = new Date(now.getTime() - ORDER_PAYMENT_TIMEOUT_MS);
    attemptedTasks += 2;
    const switches = await getOpsKillSwitches(database);
    const [orderCleanupResult, automaticDeliveryResult] = await Promise.allSettled([
      closeExpiredPendingOrders(database, cutoff, 100, reconciliation?.closeableOrderIds ?? []),
      switches.autoFulfillEnabled
        ? processPendingAutomaticDeliveries(database)
        : Promise.resolve({ attempted: 0, delivered: 0, failed: 0, paused: true as const }),
    ]);
    if (orderCleanupResult.status === "fulfilled") {
      orderCleanup = orderCleanupResult.value;
    } else {
      failedTasks += 1;
      failures.push(`订单自动关闭: ${errorMessage(orderCleanupResult.reason)}`);
      reportUnexpectedServerError("scheduled-order-auto-close", orderCleanupResult.reason, { cutoff: cutoff.toISOString() });
    }
    if (automaticDeliveryResult.status === "fulfilled") {
      automaticDelivery = automaticDeliveryResult.value;
      if (automaticDelivery.failed > 0) failures.push(`自动发货失败: ${automaticDelivery.failed}`);
    } else {
      failedTasks += 1;
      failures.push(`自动发货: ${errorMessage(automaticDeliveryResult.reason)}`);
      reportUnexpectedServerError("scheduled-automatic-delivery", automaticDeliveryResult.reason);
    }
  }

  attemptedTasks += 1;
  try {
    orderEvents = await processOrderEvents(database, runtime, now);
    if (orderEvents.failed > 0) failures.push(`订单消息处理失败: ${orderEvents.failed}`);
  } catch (cause) {
    failedTasks += 1;
    failures.push(`订单消息处理: ${errorMessage(cause)}`);
    reportUnexpectedServerError("scheduled-order-events", cause);
  }

  attemptedTasks += 1;
  try {
    const switchesForSupplier = await getOpsKillSwitches(database);
    if (!switchesForSupplier.autoFulfillEnabled) {
      supplierOrders = { processed: 0, failed: 0, paused: true as const };
    } else {
      supplierOrders = await processPendingSupplierOrders(database, runtime);
      if (supplierOrders.failed > 0) failures.push(`供应商采购失败: ${supplierOrders.failed}`);
    }
  } catch (cause) {
    failedTasks += 1;
    failures.push(`供应商采购: ${errorMessage(cause)}`);
    reportUnexpectedServerError("scheduled-supplier-orders", cause);
  }

  if (runFiveMinuteMaintenance) {
    attemptedTasks += 1;
    try {
      supplierMaintenance = await runSupplierMaintenance(database, now);
      if (supplierMaintenance.failed > 0) failures.push(`供应商同步失败: ${supplierMaintenance.failed}`);
    } catch (cause) {
      failedTasks += 1;
      failures.push(`供应商同步: ${errorMessage(cause)}`);
      reportUnexpectedServerError("scheduled-supplier-sync", cause);
    }
  }

  attemptedTasks += 1;
  try {
    pushRetry = await retryDuePushes(database, runtime, now);
    if (pushRetry.exhausted > 0) failures.push(`推送重试已耗尽: ${pushRetry.exhausted}`);
  } catch (cause) {
    failedTasks += 1;
    failures.push(`推送重试: ${errorMessage(cause)}`);
    reportUnexpectedServerError("scheduled-push-retry", cause);
  }

  // Monthly BNM average FX: run once around 01:00–01:05 UTC on day 2 of month (after prior month complete)
  const klParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const klDay = Number(klParts.find((p) => p.type === "day")?.value ?? 0);
  const klHour = Number(klParts.find((p) => p.type === "hour")?.value ?? -1);
  if (klDay === 2 && klHour === 1 && now.getUTCMinutes() < 5) {
    attemptedTasks += 1;
    try {
      fxSync = await syncPreviousMonthBnmRates(database, now);
      if (fxSync.stored === 0) failures.push(`BNM汇率同步为空: ${fxSync.yearMonth}`);
    } catch (cause) {
      failedTasks += 1;
      failures.push(`BNM汇率同步: ${errorMessage(cause)}`);
      reportUnexpectedServerError("scheduled-bnm-fx-sync", cause);
    }
  }

  if (failures.length > 0) {
    try {
      await recordScheduledMaintenanceFailure(database, {
        status: failedTasks === attemptedTasks ? "FAILED" : "PARTIAL",
        scannedOrderCount: orderCleanup?.scanned ?? null,
        closedOrderCount: orderCleanup?.closed ?? null,
        pushRetryAttempted: pushRetry?.attempted ?? null,
        pushRetrySent: pushRetry?.sent ?? null,
        pushRetryExhausted: pushRetry?.exhausted ?? null,
        error: failures.join("\n").slice(0, 1_000),
        startedAt,
        completedAt: new Date(),
      });
    } catch (cause) {
      reportUnexpectedServerError("scheduled-task-log-failure", cause);
    }
  }

  let opsAlerts: Awaited<ReturnType<typeof runOpsHealthAlerts>> | null = null;
  try {
    opsAlerts = await runOpsHealthAlerts(database, now);
  } catch (cause) {
    reportUnexpectedServerError("scheduled-ops-health-alerts", cause);
  }

  return { runFiveMinuteMaintenance, reconciliation, orderCleanup, automaticDelivery, supplierOrders, supplierMaintenance, orderEvents, pushRetry, opsAlerts, fxSync };
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
