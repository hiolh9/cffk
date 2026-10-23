import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, siteSetting, user } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";

/** Amounts are integer sen (MYR cents). 0 = unlimited for amount/count caps. */
export type OpsRiskLimits = {
  maxOrderAmountCents: number;
  maxDailyUserAmountCents: number;
  maxDailyUserOrders: number;
  maxHourlyUserOrders: number;
  newAccountWindowHours: number;
  newAccountMaxOrderCents: number;
  newAccountMaxOrders: number;
  reviewOrderAmountCents: number;
};

const DEFAULTS: OpsRiskLimits = {
  maxOrderAmountCents: 50_000,
  maxDailyUserAmountCents: 200_000,
  maxDailyUserOrders: 50,
  maxHourlyUserOrders: 10,
  newAccountWindowHours: 24,
  newAccountMaxOrderCents: 10_000,
  newAccountMaxOrders: 3,
  reviewOrderAmountCents: 30_000,
};

function nonNegInt(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export async function getOpsRiskLimits(database: D1Database): Promise<OpsRiskLimits> {
  try {
    const db = createDrizzleDb(database);
    // Select full row then read soft columns via any until schema-tables-a is migrated in types.
    const [row] = await db.select().from(siteSetting).where(eq(siteSetting.id, 1)).limit(1);
    if (!row) return { ...DEFAULTS };
    const r = row as Record<string, unknown>;
    return {
      maxOrderAmountCents: nonNegInt(r.maxOrderAmountCents, DEFAULTS.maxOrderAmountCents),
      maxDailyUserAmountCents: nonNegInt(r.maxDailyUserAmountCents, DEFAULTS.maxDailyUserAmountCents),
      maxDailyUserOrders: nonNegInt(r.maxDailyUserOrders, DEFAULTS.maxDailyUserOrders),
      maxHourlyUserOrders: nonNegInt(r.maxHourlyUserOrders, DEFAULTS.maxHourlyUserOrders),
      reviewOrderAmountCents: nonNegInt(r.reviewOrderAmountCents, DEFAULTS.reviewOrderAmountCents),
      newAccountWindowHours: nonNegInt(r.newAccountWindowHours, DEFAULTS.newAccountWindowHours),
      newAccountMaxOrderCents: nonNegInt(r.newAccountMaxOrderCents, DEFAULTS.newAccountMaxOrderCents),
      newAccountMaxOrders: nonNegInt(r.newAccountMaxOrders, DEFAULTS.newAccountMaxOrders),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toMs(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function enforceOrderRiskLimits(
  database: D1Database,
  input: { ownerUserId: string | null; amountCents: number; now?: Date },
) {
  const limits = await getOpsRiskLimits(database);
  const amount = Math.max(0, Math.floor(input.amountCents));
  const now = input.now ?? new Date();

  if (limits.maxOrderAmountCents > 0 && amount > limits.maxOrderAmountCents) {
    appError("ORDER_AMOUNT_LIMIT");
  }

  if (!input.ownerUserId) return;

  const db = createDrizzleDb(database);

  const [account] = await db
    .select({ createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, input.ownerUserId))
    .limit(1);
  const createdMs = toMs(account?.createdAt);
  const windowMs = Math.max(0, limits.newAccountWindowHours) * 60 * 60_000;
  const isNewAccount = windowMs > 0 && createdMs != null && now.getTime() - createdMs < windowMs;

  if (isNewAccount && limits.newAccountMaxOrderCents > 0 && amount > limits.newAccountMaxOrderCents) {
    appError("NEW_ACCOUNT_ORDER_LIMIT");
  }

  if (isNewAccount && limits.newAccountMaxOrders > 0 && createdMs != null) {
    const sinceReg = new Date(createdMs);
    const [newAgg] = await db
      .select({ orderCount: sql<number>`count(*)` })
      .from(order)
      .where(
        and(
          eq(order.ownerUserId, input.ownerUserId),
          gte(order.createdAt, sinceReg),
          inArray(order.status, ["PENDING", "PAID", "DELIVERED"]),
        ),
      );
    if (Number(newAgg?.orderCount ?? 0) >= limits.newAccountMaxOrders) {
      appError("NEW_ACCOUNT_ORDER_COUNT_LIMIT");
    }
  }

  const hourAgo = new Date(now.getTime() - 60 * 60_000);
  if (limits.maxHourlyUserOrders > 0) {
    const [hourAgg] = await db
      .select({ orderCount: sql<number>`count(*)` })
      .from(order)
      .where(
        and(
          eq(order.ownerUserId, input.ownerUserId),
          gte(order.createdAt, hourAgo),
          inArray(order.status, ["PENDING", "PAID", "DELIVERED"]),
        ),
      );
    if (Number(hourAgg?.orderCount ?? 0) >= limits.maxHourlyUserOrders) {
      appError("ORDER_HOURLY_COUNT_LIMIT");
    }
  }

  const since = startOfUtcDay(now);

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

export async function getReviewOrderAmountCents(database: D1Database) {
  const limits = await getOpsRiskLimits(database);
  return limits.reviewOrderAmountCents;
}
