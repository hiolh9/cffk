/**
 * Short-lived step-up confirmation for sensitive admin mutations
 * (credential changes, account deletion, etc.).
 * Granted automatically on successful login; valid ~15 minutes.
 */

const STEP_UP_TTL_MS = 15 * 60_000;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function stepUpKey(userId: string) {
  const payload = new TextEncoder().encode(`step-up:v1:${userId}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", payload)));
}

export async function grantStepUp(database: D1Database, userId: string, now = Date.now()) {
  const keyHash = await stepUpKey(userId);
  const expiresAt = now + STEP_UP_TTL_MS;
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

export const STEP_UP_TTL_MINUTES = STEP_UP_TTL_MS / 60_000;
