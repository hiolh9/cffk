import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { siteSetting } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";

const FALLBACK_MAX = 3;
const FALLBACK_WINDOW_MS = 24 * 60 * 60_000;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashKey(parts: string) {
  const payload = new TextEncoder().encode(`device-multi-user:v1:${parts}`);
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
    const [row] = await db.select().from(siteSetting).where(eq(siteSetting.id, 1)).limit(1);
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      maxUsers: nonNegInt(r.deviceMultiUserMaxUsers, FALLBACK_MAX),
      windowMs: Math.max(1, nonNegInt(r.deviceMultiUserWindowMinutes, 1440)) * 60_000,
    };
  } catch {
    return { maxUsers: FALLBACK_MAX, windowMs: FALLBACK_WINDOW_MS };
  }
}

async function bump(database: D1Database, keyHash: string, now: number, expiresAt: number) {
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

/** Same device fingerprint may only be used by N distinct user ids in a window. */
export async function enforceDeviceMultiUserLimit(
  database: D1Database,
  input: { deviceId: string; userId: string; now?: Date },
) {
  const deviceId = input.deviceId?.trim();
  const userId = input.userId?.trim();
  if (!deviceId || !userId) return;

  const policy = await loadPolicy(database);
  if (policy.maxUsers <= 0) return;

  const now = input.now?.getTime() ?? Date.now();
  const expiresAt = now + policy.windowMs;

  const seenKey = await hashKey(`seen:${deviceId}:${userId}`);
  const seenCount = await bump(database, seenKey, now, expiresAt);
  if (seenCount !== 1) return;

  const diversityKey = await hashKey(`diversity:${deviceId}`);
  const distinct = await bump(database, diversityKey, now, expiresAt);
  if (distinct > policy.maxUsers) {
    appError("DEVICE_MULTI_USER_LIMIT");
  }
}
