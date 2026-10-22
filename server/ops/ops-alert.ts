import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, pushChannelConfig, supplierAccount, supplierOrder } from "@/database/drizzle/schema";
import { parseTelegramProviderConfig, sendTelegramPush } from "@/server/push/telegram-provider";
import { reportUnexpectedServerError } from "@/server/error-handling";

const ALERT_COOLDOWN_MS = 60 * 60_000;
const lastSent = new Map<string, number>();

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

  const [failAgg] = await db
    .select({ failed: sql<number>`count(*)` })
    .from(supplierOrder)
    .where(and(inArray(supplierOrder.state, ["failed", "dead"]), gte(supplierOrder.updatedAt, since)));

  const failed = Number(failAgg?.failed ?? 0);
  const results: { key: string; sent: boolean; reason?: string }[] = [];

  if (failed >= 5) {
    const r = await trySendAdminTelegram(
      database,
      "供应商代充异常",
      `最近 15 分钟内有 ${failed} 笔供应商订单失败。请检查供应商账户、余额与 API。必要时在站点设置中关闭「自动代充」。`,
      "supplier-fail-burst",
    );
    results.push({ key: "supplier-fail-burst", ...r });
  }

  // Paid-order burst: possible card testing or promo abuse after gateway pass.
  const [paidAgg] = await db
    .select({ paid: sql<number>`count(*)` })
    .from(order)
    .where(and(eq(order.paymentStatus, "PAID"), gte(order.paidAt, since)));
  const paid = Number(paidAgg?.paid ?? 0);
  if (paid >= 20) {
    const r = await trySendAdminTelegram(
      database,
      "支付成功订单激增",
      `最近 15 分钟有 ${paid} 笔订单标记为已支付。请核对网关账单与库存/代充预存款，必要时暂停下单或自动代充。`,
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
