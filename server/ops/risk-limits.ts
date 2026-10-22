import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, siteSetting, user } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";

/** Amounts are integer sen (MYR cents). 0 = unlimited. */
export type OpsRiskLimits = {
  maxOrderAmountCents: number;
  maxDailyUserAmountCents: number;
  maxDailyUserOrders: number;
};

const DEFAULTS: OpsRiskLimits = {
  maxOrderAmountCents: 50_000,
  maxDailyUserAmountCents: 200_000,
  maxDailyUserOrders: 50,
};

function nonNegInt(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export async function getOpsRiskLimits(database: D1Database): Promise<OpsRiskLimits> {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({
        maxOrderAmountCents: siteSetting.maxOrderAmountCents,
        maxDailyUserAmountCents: siteSetting.maxDailyUserAmountCents,
        maxDailyUserOrders: siteSetting.maxDailyUserOrders,
      })
      .from(siteSetting)
      .where(eq(siteSetting.id, 1))
      .limit(1);
    if (!row) return { ...DEFAULTS };
    return {
      maxOrderAmountCents: nonNegInt(row.maxOrderAmountCents, DEFAULTS.maxOrderAmountCents),
      maxDailyUserAmountCents: nonNegInt(row.maxDailyUserAmountCents, DEFAULTS.maxDailyUserAmountCents),
      maxDailyUserOrders: nonNegInt(row.maxDailyUserOrders, DEFAULTS.maxDailyUserOrders),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function enforceOrderRiskLimits(
  database: D1Database,
  input: { ownerUserId: string | null; amountCents: number; now?: Date },
) {
  const limits = await getOpsRiskLimits(database);
  const amount = Math.max(0, Math.floor(input.amountCents));

  if (limits.maxOrderAmountCents > 0 && amount > limits.maxOrderAmountCents) {
    appError("ORDER_AMOUNT_LIMIT");
  }

  if (!input.ownerUserId) return;

  const db = createDrizzleDb(database);
  const since = startOfUtcDay(input.now);

  const [agg] = await db
    .select({
      orderCount: sql<number>`count(*)`,
      amountSum: sql<number>`coalesce(sum(${order.amount}), 0)`,
    })
    .from(order)
    .where(
      and(
        eq(order.ownerUserId, input.ownerUserId),
        gte(order.createdAt, since),
        inArray(order.status, ["PENDING", "PAID", "DELIVERED"]),
      ),
    );

  const orderCount = Number(agg?.orderCount ?? 0);
  const amountSum = Number(agg?.amountSum ?? 0);

  if (limits.maxDailyUserOrders > 0 && orderCount >= limits.maxDailyUserOrders) {
    appError("ORDER_DAILY_COUNT_LIMIT");
  }
  if (limits.maxDailyUserAmountCents > 0 && amountSum + amount > limits.maxDailyUserAmountCents) {
    appError("ORDER_DAILY_AMOUNT_LIMIT");
  }
}

export async function assertCheckoutAccount(database: D1Database, userId: string) {
  const db = createDrizzleDb(database);
  const [row] = await db
    .select({
      disabledAt: user.disabledAt,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) appError("AUTH_REQUIRED");
  if (row.disabledAt) appError("ACCOUNT_DISABLED");
  if (!row.emailVerified) appError("EMAIL_NOT_VERIFIED");
}
