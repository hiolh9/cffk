/**
 * Short-lived step-up confirmation for sensitive admin mutations.
 * TTL is soft-coded via siteSetting.stepUpMinutes (default 10).
 */

import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { siteSetting } from "@/database/drizzle/schema";

const FALLBACK_TTL_MS = 10 * 60_000;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function stepUpKey(userId: string) {
  const payload = new TextEncoder().encode(`step-up:v1:${userId}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", payload)));
}

async function resolveTtlMs(database: D1Database) {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({ stepUpMinutes: siteSetting.stepUpMinutes })
      .from(siteSetting)
      .where(eq(siteSetting.id, 1))
      .limit(1);
    const minutes = Number(row?.stepUpMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return FALLBACK_TTL_MS;
    return Math.min(Math.floor(minutes), 120) * 60_000;
  } catch {
    return FALLBACK_TTL_MS;
  }
}

export async function grantStepUp(database: D1Database, userId: string, now = Date.now()) {
  const keyHash = await stepUpKey(userId);
  const ttl = await resolveTtlMs(database);
  const expiresAt = now + ttl;
  await database
    .prepare(
      `
    INSERT INTO orderRequestRateLimit (keyHash, requestCount, expiresAt, createdAt, updatedAt)
    VALUES (?, 1, ?, ?, ?)
    ON CONFLICT(keyHash) DO UPDATE SET
      requestCount = 1,
      expiresAt = excluded.expiresAt,
      updatedAt = excluded.updatedAt
  `,
    )
    .bind(keyHash, expiresAt, now, now)
    .run();
  return { validMinutes: Math.round(ttl / 60_000) };
}

export async function hasValidStepUp(database: D1Database, userId: string, now = Date.now()) {
  const keyHash = await stepUpKey(userId);
  const row = await database
    .prepare(`SELECT expiresAt FROM orderRequestRateLimit WHERE keyHash = ?`)
    .bind(keyHash)
    .first<{ expiresAt: number }>();
  if (!row) return false;
  return Number(row.expiresAt) > now;
}

export async function assertStepUp(database: D1Database, userId: string) {
  const { appError } = await import("@/lib/app-error");
  if (!(await hasValidStepUp(database, userId))) {
    appError("ADMIN_STEP_UP_REQUIRED");
  }
}

/** Fallback for UI before settings load. */
export const STEP_UP_TTL_MINUTES = FALLBACK_TTL_MS / 60_000;

export async function getStepUpMinutes(database: D1Database) {
  return Math.round((await resolveTtlMs(database)) / 60_000);
}
