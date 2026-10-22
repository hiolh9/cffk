import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { siteSetting } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";

/**
 * Soft multi-account control: same client IP may only be used by a limited
 * number of distinct user ids within a rolling window (from siteSetting).
 */

const FALLBACK_WINDOW_MS = 60 * 60_000;
const FALLBACK_MAX_USERS = 6;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashKey(parts: string) {
  const payload = new TextEncoder().encode(`ip-multi-account:v1:${parts}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", payload)));
}

function nonNegInt(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

async function loadPolicy(database: D1Database) {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({
        maxUsers: siteSetting.ipMultiAccountMaxUsers,
        windowMinutes: siteSetting.ipMultiAccountWindowMinutes,
      })
      .from(siteSetting)
      .where(eq(siteSetting.id, 1))
      .limit(1);
    return {
      maxUsers: nonNegInt(row?.maxUsers, FALLBACK_MAX_USERS),
      windowMs: Math.max(1, nonNegInt(row?.windowMinutes, 60)) * 60_000,
    };
  } catch {
    return { maxUsers: FALLBACK_MAX_USERS, windowMs: FALLBACK_WINDOW_MS };
  }
}

async function bump(
  database: D1Database,
  keyHash: string,
  now: number,
  expiresAt: number,
): Promise<number> {
  const result = await database
    .prepare(
      `
    INSERT INTO orderRequestRateLimit (keyHash, requestCount, expiresAt, createdAt, updatedAt)
    VALUES (?, 1, ?, ?, ?)
    ON CONFLICT(keyHash) DO UPDATE SET
      requestCount = CASE
        WHEN orderRequestRateLimit.expiresAt <= excluded.updatedAt THEN 1
        ELSE orderRequestRateLimit.requestCount + 1
      END,
      expiresAt = CASE
        WHEN orderRequestRateLimit.expiresAt <= excluded.updatedAt THEN excluded.expiresAt
        ELSE orderRequestRateLimit.expiresAt
      END,
      updatedAt = excluded.updatedAt
    RETURNING requestCount
  `,
    )
    .bind(keyHash, expiresAt, now, now)
    .first<{ requestCount: number }>();
  return Number(result?.requestCount ?? 1);
}

export async function enforceIpMultiAccountLimit(
  database: D1Database,
  input: { clientIp?: string | null; userId: string; now?: Date },
) {
  const ip = input.clientIp?.trim();
  if (!ip || ip === "unknown") return;

  const policy = await loadPolicy(database);
  // 0 = disabled
  if (policy.maxUsers <= 0) return;

  const now = input.now?.getTime() ?? Date.now();
  const expiresAt = now + policy.windowMs;
  const userId = input.userId.trim();
  if (!userId) return;

  const seenKey = await hashKey(`seen:${ip}:${userId}`);
  const seenCount = await bump(database, seenKey, now, expiresAt);

  if (seenCount !== 1) return;

  const diversityKey = await hashKey(`diversity:${ip}`);
  const distinct = await bump(database, diversityKey, now, expiresAt);
  if (distinct > policy.maxUsers) {
    appError("IP_MULTI_ACCOUNT_LIMIT");
  }
}

export async function getIpMultiAccountPolicy(database: D1Database) {
  const p = await loadPolicy(database);
  return {
    maxDistinctUsers: p.maxUsers,
    windowMinutes: Math.round(p.windowMs / 60_000),
  };
}
