const FAIL_WINDOW_MS = 30 * 60_000;
const MAX_FAILURES = 8;
const LOCK_MS = 30 * 60_000;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashKey(kind: "email" | "ip", value: string) {
  const payload = new TextEncoder().encode(`login-lockout:v1:${kind}:${value}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", payload)));
}

async function readCount(database: D1Database, keyHash: string, now: number) {
  const row = await database
    .prepare(`SELECT requestCount, expiresAt FROM orderRequestRateLimit WHERE keyHash = ?`)
    .bind(keyHash)
    .first<{ requestCount: number; expiresAt: number }>();
  if (!row) return 0;
  if (Number(row.expiresAt) <= now) return 0;
  return Number(row.requestCount) || 0;
}

async function writeCount(database: D1Database, keyHash: string, count: number, expiresAt: number, now: number) {
  await database
    .prepare(
      `
    INSERT INTO orderRequestRateLimit (keyHash, requestCount, expiresAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(keyHash) DO UPDATE SET
      requestCount = excluded.requestCount,
      expiresAt = excluded.expiresAt,
      updatedAt = excluded.updatedAt
  `,
    )
    .bind(keyHash, count, expiresAt, now, now)
    .run();
}

export async function getLoginLockStatus(
  database: D1Database,
  input: { email?: string | null; clientIp?: string | null; now?: number },
): Promise<{ locked: boolean; retryAfterSec: number; failures: number }> {
  const now = input.now ?? Date.now();
  const email = input.email?.trim().toLowerCase() || "";
  const ip = input.clientIp?.trim() || "";

  let maxFailures = 0;
  let maxExpiry = 0;

  if (email) {
    const key = await hashKey("email", email);
    const count = await readCount(database, key, now);
    maxFailures = Math.max(maxFailures, count);
    if (count >= MAX_FAILURES) {
      const row = await database
        .prepare(`SELECT expiresAt FROM orderRequestRateLimit WHERE keyHash = ?`)
        .bind(key)
        .first<{ expiresAt: number }>();
      maxExpiry = Math.max(maxExpiry, Number(row?.expiresAt ?? 0));
    }
  }
  if (ip) {
    const key = await hashKey("ip", ip);
    const count = await readCount(database, key, now);
    maxFailures = Math.max(maxFailures, count);
    if (count >= MAX_FAILURES) {
      const row = await database
        .prepare(`SELECT expiresAt FROM orderRequestRateLimit WHERE keyHash = ?`)
        .bind(key)
        .first<{ expiresAt: number }>();
      maxExpiry = Math.max(maxExpiry, Number(row?.expiresAt ?? 0));
    }
  }

  if (maxFailures >= MAX_FAILURES && maxExpiry > now) {
    return { locked: true, retryAfterSec: Math.ceil((maxExpiry - now) / 1000), failures: maxFailures };
  }
  return { locked: false, retryAfterSec: 0, failures: maxFailures };
}

export async function recordLoginFailure(
  database: D1Database,
  input: { email?: string | null; clientIp?: string | null; now?: number },
) {
  const now = input.now ?? Date.now();
  const expiresAt = now + Math.max(FAIL_WINDOW_MS, LOCK_MS);
  const email = input.email?.trim().toLowerCase() || "";
  const ip = input.clientIp?.trim() || "";

  for (const [kind, value] of [
    ["email", email],
    ["ip", ip],
  ] as const) {
    if (!value) continue;
    const key = await hashKey(kind, value);
    const prev = await readCount(database, key, now);
    await writeCount(database, key, prev + 1, expiresAt, now);
  }
}

export async function clearLoginFailures(
  database: D1Database,
  input: { email?: string | null; clientIp?: string | null },
) {
  const email = input.email?.trim().toLowerCase() || "";
  const ip = input.clientIp?.trim() || "";
  for (const [kind, value] of [
    ["email", email],
    ["ip", ip],
  ] as const) {
    if (!value) continue;
    const key = await hashKey(kind, value);
    await database.prepare(`DELETE FROM orderRequestRateLimit WHERE keyHash = ?`).bind(key).run();
  }
}

export const LOGIN_LOCKOUT_POLICY = { maxFailures: MAX_FAILURES, lockMinutes: LOCK_MS / 60_000 } as const;
