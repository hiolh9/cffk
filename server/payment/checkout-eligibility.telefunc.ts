import { telefuncAction } from "@/server/telefunc-action";
import { requireUser } from "@/server/telefunc-context";
import { getOpsRiskLimits, assertCheckoutAccount } from "@/server/ops/risk-limits";
import { getOpsKillSwitches } from "@/server/ops/kill-switch";
import { appError } from "@/lib/app-error";
import { createDrizzleDb } from "@/database/drizzle";
import { order, user } from "@/database/drizzle/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { formatCentsAsYuan } from "@/lib/payment-utils";

/**
 * Call before showing payment button / confirm step.
 * Returns remaining quotas so the UI can warn early.
 */
export const onGetCheckoutEligibility = telefuncAction(async (input?: { amountCents?: number }) => {
  const { user: sessionUser, database } = requireUser();
  const switches = await getOpsKillSwitches(database);
  if (!switches.checkoutEnabled) {
    return {
      ok: false as const,
      code: "CHECKOUT_DISABLED",
      message: "下单功能已暂停，请稍后再试或联系客服。",
    };
  }

  try {
    await assertCheckoutAccount(database, sessionUser.id);
  } catch {
    // surface via structured response for pre-check UI
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({ disabledAt: user.disabledAt, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);
    if (!row || row.disabledAt) {
      return { ok: false as const, code: "ACCOUNT_DISABLED", message: "账号已被停用，无法下单。" };
    }
    if (!row.emailVerified) {
      return { ok: false as const, code: "EMAIL_NOT_VERIFIED", message: "请先完成邮箱验证后再下单。" };
    }
  }

  const limits = await getOpsRiskLimits(database);
  const amount = Math.max(0, Math.floor(Number(input?.amountCents) || 0));
  const db = createDrizzleDb(database);
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const hourAgo = new Date(now.getTime() - 60 * 60_000);

  const [dayAgg] = await db
    .select({
      orderCount: sql<number>`count(*)`,
      amountSum: sql<number>`coalesce(sum(${order.amount}), 0)`,
    })
    .from(order)
    .where(
      and(
        eq(order.ownerUserId, sessionUser.id),
        gte(order.createdAt, since),
        inArray(order.status, ["PENDING", "PAID", "DELIVERED"]),
      ),
    );

  const [hourAgg] = await db
    .select({ orderCount: sql<number>`count(*)` })
    .from(order)
    .where(
      and(
        eq(order.ownerUserId, sessionUser.id),
        gte(order.createdAt, hourAgo),
        inArray(order.status, ["PENDING", "PAID", "DELIVERED"]),
      ),
    );

  const dayCount = Number(dayAgg?.orderCount ?? 0);
  const dayAmount = Number(dayAgg?.amountSum ?? 0);
  const hourCount = Number(hourAgg?.orderCount ?? 0);

  const blockers: Array<{ code: string; message: string }> = [];
  if (limits.maxOrderAmountCents > 0 && amount > limits.maxOrderAmountCents) {
    blockers.push({
      code: "ORDER_AMOUNT_LIMIT",
      message: `单笔上限 ${formatCentsAsYuan(limits.maxOrderAmountCents)}，当前选择已超出。`,
    });
  }
  if (limits.maxHourlyUserOrders > 0 && hourCount >= limits.maxHourlyUserOrders) {
    blockers.push({ code: "ORDER_HOURLY_COUNT_LIMIT", message: "本小时下单次数已达上限，请稍后再试。" });
  }
  if (limits.maxDailyUserOrders > 0 && dayCount >= limits.maxDailyUserOrders) {
    blockers.push({ code: "ORDER_DAILY_COUNT_LIMIT", message: "今日下单次数已达上限，请明日再试。" });
  }
  if (limits.maxDailyUserAmountCents > 0 && dayAmount + amount > limits.maxDailyUserAmountCents) {
    blockers.push({
      code: "ORDER_DAILY_AMOUNT_LIMIT",
      message: `今日累计金额上限 ${formatCentsAsYuan(limits.maxDailyUserAmountCents)}，已用 ${formatCentsAsYuan(dayAmount)}。`,
    });
  }

  return {
    ok: blockers.length === 0,
    blockers,
    quotas: {
      maxOrderAmount: formatCentsAsYuan(limits.maxOrderAmountCents),
      dayOrdersUsed: dayCount,
      dayOrdersMax: limits.maxDailyUserOrders,
      dayAmountUsed: formatCentsAsYuan(dayAmount),
      dayAmountMax: formatCentsAsYuan(limits.maxDailyUserAmountCents),
      hourOrdersUsed: hourCount,
      hourOrdersMax: limits.maxHourlyUserOrders,
    },
  };
});
