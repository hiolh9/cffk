import { appError } from "@/lib/app-error";

/**
 * Soft multi-account control: same client IP may only be used by a limited
 * number of distinct user ids within a rolling window. Uses the shared
 * orderRequestRateLimit table (no migration).
 *
 * Not a hard identity graph — only slows mass burner-account abuse.
 */

const WINDOW_MS = 60 * 60_000;
const MAX_DISTINCT_USERS_PER_IP = 6;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashKey(parts: string) {
  const payload = new TextEncoder().encode(`ip-multi-account:v1:${parts}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", payload)));
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

/**
 * Call once per successful checkout attempt for a logged-in user.
 * First time a user is seen on an IP in the window increments the IP's distinct-user counter.
 */
export async function enforceIpMultiAccountLimit(
  database: D1Database,
  input: { clientIp?: string | null; userId: string; now?: Date },
) {
  const ip = input.clientIp?.trim();
  if (!ip || ip === "unknown") return;

  const now = input.now?.getTime() ?? Date.now();
  const expiresAt = now + WINDOW_MS;
  const userId = input.userId.trim();
  if (!userId) return;

  const seenKey = await hashKey(`seen:${ip}:${userId}`);
  const seenCount = await bump(database, seenKey, now, expiresAt);

  // Only the first hit for this user+ip in the window counts toward diversity.
  if (seenCount !== 1) return;

  const diversityKey = await hashKey(`diversity:${ip}`);
  const distinct = await bump(database, diversityKey, now, expiresAt);
  if (distinct > MAX_DISTINCT_USERS_PER_IP) {
    appError("IP_MULTI_ACCOUNT_LIMIT");
  }
}

export const IP_MULTI_ACCOUNT_POLICY = {
  maxDistinctUsers: MAX_DISTINCT_USERS_PER_IP,
  windowMinutes: WINDOW_MS / 60_000,
} as const;
