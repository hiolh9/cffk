import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { order, riskUserScore, siteSetting, user } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";
import { countDeviceUsers, countUserDevices, countUserIps } from "@/server/security/device-sighting";

export type BehaviorScoreResult = {
  score: number;
  reasons: string[];
  review: boolean;
  block: boolean;
};

const DEFAULTS = {
  behaviorWindowHours: 24,
  maxDevicesPerUser: 3,
  maxIpsPerUser: 5,
  behaviorScoreReview: 50,
  behaviorScoreBlock: 80,
  newAccountWindowHours: 24,
};

function nonNegInt(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

async function loadConfig(database: D1Database) {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db.select().from(siteSetting).where(eq(siteSetting.id, 1)).limit(1);
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      behaviorWindowHours: nonNegInt(r.behaviorWindowHours, DEFAULTS.behaviorWindowHours),
      maxDevicesPerUser: nonNegInt(r.maxDevicesPerUser, DEFAULTS.maxDevicesPerUser),
      maxIpsPerUser: nonNegInt(r.maxIpsPerUser, DEFAULTS.maxIpsPerUser),
      behaviorScoreReview: nonNegInt(r.behaviorScoreReview, DEFAULTS.behaviorScoreReview),
      behaviorScoreBlock: nonNegInt(r.behaviorScoreBlock, DEFAULTS.behaviorScoreBlock),
      newAccountWindowHours: nonNegInt(r.newAccountWindowHours, DEFAULTS.newAccountWindowHours),
    };
  } catch {
    return { ...DEFAULTS };
  }
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

/**
 * Lightweight transparent score (0–100+). Soft-coded thresholds.
 * Does not replace hard limits; stacks on top of them.
 */
export async function computeAndStoreBehaviorScore(
  database: D1Database,
  input: { userId: string; deviceId: string; clientIp?: string | null; now?: Date },
): Promise<BehaviorScoreResult> {
  const cfg = await loadConfig(database);
  const now = input.now ?? new Date();
  const windowMs = Math.max(1, cfg.behaviorWindowHours) * 60 * 60_000;
  const since = new Date(now.getTime() - windowMs);
  const reasons: string[] = [];
  let score = 0;

  try {
    const db = createDrizzleDb(database);
    const [account] = await db
      .select({ createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    const createdMs = toMs(account?.createdAt);
    const newMs = Math.max(0, cfg.newAccountWindowHours) * 60 * 60_000;
    if (newMs > 0 && createdMs != null && now.getTime() - createdMs < newMs) {
      score += 30;
      reasons.push("new_account");
    }

    const [hourAgg] = await db
      .select({ n: sql<number>`count(*)` })
      .from(order)
      .where(
        and(
          eq(order.ownerUserId, input.userId),
          gte(order.createdAt, new Date(now.getTime() - 60 * 60_000)),
          inArray(order.status, ["PENDING", "PAID", "DELIVERED"]),
        ),
      );
    const hourOrders = Number(hourAgg?.n ?? 0);
    if (hourOrders >= 5) {
      score += 25;
      reasons.push("high_hourly_orders");
    } else if (hourOrders >= 3) {
      score += 12;
      reasons.push("elevated_hourly_orders");
    }
  } catch {
    /* ignore order/user query failures */
  }

  const devices = await countUserDevices(database, input.userId, since);
  if (cfg.maxDevicesPerUser > 0 && devices > cfg.maxDevicesPerUser) {
    score += 25 + Math.min(20, (devices - cfg.maxDevicesPerUser) * 8);
    reasons.push(`multi_device:${devices}`);
  }

  const ips = await countUserIps(database, input.userId, since);
  if (cfg.maxIpsPerUser > 0 && ips > cfg.maxIpsPerUser) {
    score += 20 + Math.min(20, (ips - cfg.maxIpsPerUser) * 5);
    reasons.push(`multi_ip:${ips}`);
  }

  const deviceUsers = await countDeviceUsers(database, input.deviceId, since);
  if (deviceUsers >= 4) {
    score += 30;
    reasons.push(`shared_device:${deviceUsers}`);
  } else if (deviceUsers >= 3) {
    score += 15;
    reasons.push(`shared_device:${deviceUsers}`);
  }

  const review = cfg.behaviorScoreReview > 0 && score >= cfg.behaviorScoreReview;
  const block = cfg.behaviorScoreBlock > 0 && score >= cfg.behaviorScoreBlock;

  try {
    const db = createDrizzleDb(database);
    await db
      .insert(riskUserScore)
      .values({
        userId: input.userId,
        score,
        reasonsJson: JSON.stringify(reasons),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: riskUserScore.userId,
        set: { score, reasonsJson: JSON.stringify(reasons), updatedAt: now },
      });
  } catch {
    /* table missing */
  }

  return { score, reasons, review, block };
}

export async function enforceBehaviorScore(
  database: D1Database,
  input: { userId: string; deviceId: string; clientIp?: string | null },
): Promise<BehaviorScoreResult> {
  const result = await computeAndStoreBehaviorScore(database, input);
  if (result.block) {
    try {
      const { alertBehaviorRisk } = await import("@/server/ops/ops-alert");
      await alertBehaviorRisk(database, {
        userId: input.userId,
        score: result.score,
        reasons: result.reasons,
        action: "block",
      });
    } catch {
      /* best-effort */
    }
    appError("BEHAVIOR_RISK_BLOCKED");
  }
  if (result.review) {
    try {
      const { alertBehaviorRisk } = await import("@/server/ops/ops-alert");
      await alertBehaviorRisk(database, {
        userId: input.userId,
        score: result.score,
        reasons: result.reasons,
        action: "review",
      });
    } catch {
      /* best-effort */
    }
  }
  return result;
}

export async function getStoredUserRiskScore(database: D1Database, userId: string): Promise<number> {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({ score: riskUserScore.score, updatedAt: riskUserScore.updatedAt })
      .from(riskUserScore)
      .where(eq(riskUserScore.userId, userId))
      .limit(1);
    if (!row) return 0;
    const updated = toMs(row.updatedAt);
    // Ignore scores older than 48h
    if (updated != null && Date.now() - updated > 48 * 60 * 60_000) return 0;
    return Number(row.score ?? 0);
  } catch {
    return 0;
  }
}

export async function getBehaviorReviewThreshold(database: D1Database) {
  const cfg = await loadConfig(database);
  return cfg.behaviorScoreReview;
}
