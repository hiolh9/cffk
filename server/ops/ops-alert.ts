import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, pushChannelConfig, siteSetting, supplierAccount, supplierOrder } from "@/database/drizzle/schema";
import { parseTelegramProviderConfig, sendTelegramPush } from "@/server/push/telegram-provider";
import { reportUnexpectedServerError } from "@/server/error-handling";

const ALERT_COOLDOWN_MS = 60 * 60_000;
const lastSent = new Map<string, number>();

function nonNegInt(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

async function loadAlertThresholds(database: D1Database) {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({
        alertPaidOrderBurst: siteSetting.alertPaidOrderBurst,
        alertSupplierFailBurst: siteSetting.alertSupplierFailBurst,
      })
      .from(siteSetting)
      .where(eq(siteSetting.id, 1))
      .limit(1);
    return {
      paidBurst: nonNegInt(row?.alertPaidOrderBurst, 20),
      supplierFailBurst: nonNegInt(row?.alertSupplierFailBurst, 5),
    };
  } catch {
    return { paidBurst: 20, supplierFailBurst: 5 };
  }
}

async function trySendAdminTelegram(database: D1Database, title: string, content: string, key: string) {
  const now = Date.now();
  const prev = lastSent.get(key) ?? 0;
  if (now - prev < ALERT_COOLDOWN_MS) return { sent: false, reason: "cooldown" as const };

  try {
    const db = createDrizzleDb(database);
    const [provider] = await db
      .select({ configJson: pushChannelConfig.configJson })
      .from(pushChannelConfig)
      .where(and(eq(pushChannelConfig.channel, "TELEGRAM"), eq(pushChannelConfig.isEnabled, true)))
      .limit(1);
    if (!provider?.configJson) return { sent: false, reason: "no_telegram" as const };

    const config = parseTelegramProviderConfig(provider.configJson);
    await sendTelegramPush(config, { title, content });
    lastSent.set(key, now);
    return { sent: true as const };
  } catch (cause) {
    reportUnexpectedServerError("ops-alert-telegram", cause);
    return { sent: false, reason: "send_failed" as const };
  }
}

export async function runOpsHealthAlerts(database: D1Database, now = new Date()) {
  const db = createDrizzleDb(database);
  const since = new Date(now.getTime() - 15 * 60_000);
  const thresholds = await loadAlertThresholds(database);

  const [failAgg] = await db
    .select({ failed: sql<number>`count(*)` })
    .from(supplierOrder)
    .where(and(inArray(supplierOrder.state, ["failed", "dead"]), gte(supplierOrder.updatedAt, since)));

  const failed = Number(failAgg?.failed ?? 0);
  const results: { key: string; sent: boolean; reason?: string }[] = [];

  if (thresholds.supplierFailBurst > 0 && failed >= thresholds.supplierFailBurst) {
    const r = await trySendAdminTelegram(
      database,
      "供应商代充异常",
      `最近 15 分钟内有 ${failed} 笔供应商订单失败（阈值 ${thresholds.supplierFailBurst}）。请检查供应商账户、余额与 API。必要时在站点设置中关闭「自动代充」。`,
      "supplier-fail-burst",
    );
    results.push({ key: "supplier-fail-burst", ...r });
  }

  const [paidAgg] = await db
    .select({ paid: sql<number>`count(*)` })
    .from(order)
    .where(and(eq(order.paymentStatus, "PAID"), gte(order.paidAt, since)));
  const paid = Number(paidAgg?.paid ?? 0);
  if (thresholds.paidBurst > 0 && paid >= thresholds.paidBurst) {
    const r = await trySendAdminTelegram(
      database,
      "支付成功订单激增",
      `最近 15 分钟有 ${paid} 笔订单标记为已支付（阈值 ${thresholds.paidBurst}）。请核对网关账单与库存/代充预存款，必要时暂停下单或自动代充。`,
      "paid-order-burst",
    );
    results.push({ key: "paid-order-burst", ...r });
  }

  const accounts = await db
    .select({
      name: supplierAccount.name,
      balanceMinor: supplierAccount.balanceMinor,
      currency: supplierAccount.currency,
      provider: supplierAccount.provider,
    })
    .from(supplierAccount)
    .where(eq(supplierAccount.enabled, true))
    .limit(50);

  const low: string[] = [];
  for (const a of accounts) {
    if (a.balanceMinor == null || a.balanceMinor === "") continue;
    let bal: bigint;
    try {
      bal = BigInt(a.balanceMinor);
    } catch {
      continue;
    }
    if (bal >= 0n && bal < 5000n) {
      low.push(`${a.provider}/${a.name}: ${a.balanceMinor} ${a.currency || ""}`.trim());
    }
  }
  if (low.length > 0) {
    const r = await trySendAdminTelegram(
      database,
      "供应商余额偏低",
      `以下账户余额可能不足，请及时充值预存款：\n${low.slice(0, 10).join("\n")}`,
      "supplier-balance-low",
    );
    results.push({ key: "supplier-balance-low", ...r });
  }

  return { failed, paid, lowBalanceAccounts: low.length, results };
}

export async function alertManualReviewHold(
  database: D1Database,
  input: { orderNo: string; amountCents: number; thresholdCents: number },
) {
  const rm = (input.amountCents / 100).toFixed(2);
  const thr = (input.thresholdCents / 100).toFixed(2);
  return trySendAdminTelegram(
    database,
    "大额订单待人工审核",
    `订单 ${input.orderNo} 金额 RM ${rm} 已达到人工审核阈值 RM ${thr}，已暂停自动代充。请在供应商订单中人工处理，或调高「人工审核金额阈值」后等待自动重试。`,
    `manual-review:${input.orderNo}`,
  );
}
