import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { orderIdempotency } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";

const TTL_MS = 5 * 60 * 1000;
/** Client key: UUID or opaque token, 16–64 chars. */
const KEY_RE = /^[a-zA-Z0-9_-]{16,64}$/;

export function normalizeOrderIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!KEY_RE.test(trimmed)) return null;
  return trimmed;
}

async function hashKey(userId: string, key: string): Promise<string> {
  const bytes = new TextEncoder().encode(`order-idem:v1:${userId}:${key}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type OrderIdempotencyHit = {
  keyHash: string;
  orderNo: string;
  orderId: number;
};

export type OrderIdempotencyClaim = {
  keyHash: string;
  isNew: true;
};

/**
 * Claim a client idempotency key for order creation.
 * - Missing/invalid key → null (caller may still require key at higher layer).
 * - Existing complete key within TTL → hit with orderNo.
 * - Concurrent in-flight → IDEMPOTENCY_IN_PROGRESS.
 */
export async function claimOrderIdempotency(
  database: D1Database,
  input: { userId: string; key: string | null | undefined },
): Promise<OrderIdempotencyHit | OrderIdempotencyClaim | null> {
  const key = normalizeOrderIdempotencyKey(input.key);
  if (!key) return null;

  const keyHash = await hashKey(input.userId, key);
  const now = Date.now();
  const db = createDrizzleDb(database);

  const [existing] = await db
    .select({
      userId: orderIdempotency.userId,
      orderNo: orderIdempotency.orderNo,
      orderId: orderIdempotency.orderId,
      status: orderIdempotency.status,
      expiresAt: orderIdempotency.expiresAt,
    })
    .from(orderIdempotency)
    .where(eq(orderIdempotency.keyHash, keyHash))
    .limit(1);

  if (existing) {
    const expiresAt = existing.expiresAt instanceof Date ? existing.expiresAt.getTime() : Number(existing.expiresAt);
    if (existing.userId !== input.userId) appError("IDEMPOTENCY_KEY_CONFLICT");
    if (expiresAt > now && existing.status === "COMPLETE" && existing.orderNo && existing.orderId != null) {
      return { keyHash, orderNo: existing.orderNo, orderId: existing.orderId };
    }
    if (expiresAt > now && existing.status === "PENDING") {
      appError("IDEMPOTENCY_IN_PROGRESS");
    }
  }

  const expiresAt = now + TTL_MS;
  try {
    await database
      .prepare(
        `INSERT INTO orderIdempotency (keyHash, userId, orderNo, orderId, status, expiresAt, createdAt)
         VALUES (?, ?, NULL, NULL, 'PENDING', ?, ?)
         ON CONFLICT(keyHash) DO UPDATE SET
           userId = excluded.userId,
           orderNo = NULL,
           orderId = NULL,
           status = 'PENDING',
           expiresAt = excluded.expiresAt,
           createdAt = excluded.createdAt
         WHERE orderIdempotency.expiresAt <= ? OR orderIdempotency.status != 'COMPLETE'`,
      )
      .bind(keyHash, input.userId, expiresAt, now, now)
      .run();
  } catch {
    // Table missing before migration: skip rather than break checkout.
    return null;
  }

  const [again] = await db
    .select({
      userId: orderIdempotency.userId,
      orderNo: orderIdempotency.orderNo,
      orderId: orderIdempotency.orderId,
      status: orderIdempotency.status,
      expiresAt: orderIdempotency.expiresAt,
    })
    .from(orderIdempotency)
    .where(eq(orderIdempotency.keyHash, keyHash))
    .limit(1);

  if (again?.status === "COMPLETE" && again.orderNo && again.orderId != null) {
    const expiresAtMs = again.expiresAt instanceof Date ? again.expiresAt.getTime() : Number(again.expiresAt);
    if (expiresAtMs > now && again.userId === input.userId) {
      return { keyHash, orderNo: again.orderNo, orderId: again.orderId };
    }
  }
  if (again?.status === "PENDING" && again.userId === input.userId && again.orderNo) {
    const expiresAtMs = again.expiresAt instanceof Date ? again.expiresAt.getTime() : Number(again.expiresAt);
    if (expiresAtMs > now) {
      return { keyHash, orderNo: again.orderNo, orderId: again.orderId! };
    }
  }

  return { keyHash, isNew: true };
}

export async function completeOrderIdempotency(
  database: D1Database,
  input: { keyHash: string; orderNo: string; orderId: number },
): Promise<void> {
  try {
    await database
      .prepare(
        `UPDATE orderIdempotency SET orderNo = ?, orderId = ?, status = 'COMPLETE' WHERE keyHash = ?`,
      )
      .bind(input.orderNo, input.orderId, input.keyHash)
      .run();
  } catch {
    // best-effort
  }
}
