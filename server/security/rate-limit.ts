import { eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { siteSetting } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";

export type SecurityRateAction =
  | "AUTH_SIGN_IN"
  | "AUTH_SIGN_UP"
  | "AUTH_PASSWORD_RESET"
  | "AUTH_2FA"
  | "TELEFUNC"
  | "ADMIN_TELEFUNC"
  | "ORDER_CREATE_IP"
  | "ORDER_CREATE_USER"
  | "ORDER_CREATE_DEVICE";

const STATIC_POLICY: Record<
  Exclude<SecurityRateAction, "ORDER_CREATE_IP" | "ORDER_CREATE_USER" | "ORDER_CREATE_DEVICE">,
  { limit: number; windowMs: number }
> = {
  AUTH_SIGN_IN: { limit: 12, windowMs: 15 * 60_000 },
  AUTH_SIGN_UP: { limit: 8, windowMs: 60 * 60_000 },
  AUTH_PASSWORD_RESET: { limit: 6, windowMs: 60 * 60_000 },
  AUTH_2FA: { limit: 20, windowMs: 15 * 60_000 },
  TELEFUNC: { limit: 180, windowMs: 60_000 },
  ADMIN_TELEFUNC: { limit: 240, windowMs: 60_000 },
};

const ORDER_DEFAULTS = {
  ORDER_CREATE_IP: 12,
  ORDER_CREATE_USER: 6,
  ORDER_CREATE_DEVICE: 8,
  windowMinutes: 15,
};

function nonNegInt(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

async function resolvePolicy(
  database: D1Database,
  action: SecurityRateAction,
): Promise<{ limit: number; windowMs: number }> {
  if (action === "ORDER_CREATE_IP" || action === "ORDER_CREATE_USER" || action === "ORDER_CREATE_DEVICE") {
    try {
      const db = createDrizzleDb(database);
      const [row] = await db
        .select({
          orderCreateIpLimit: siteSetting.orderCreateIpLimit,
          orderCreateUserLimit: siteSetting.orderCreateUserLimit,
          orderCreateDeviceLimit: siteSetting.orderCreateDeviceLimit,
          orderCreateWindowMinutes: siteSetting.orderCreateWindowMinutes,
        })
        .from(siteSetting)
        .where(eq(siteSetting.id, 1))
        .limit(1);
      const windowMs = Math.max(1, nonNegInt(row?.orderCreateWindowMinutes, ORDER_DEFAULTS.windowMinutes)) * 60_000;
      const limit =
        action === "ORDER_CREATE_IP"
          ? nonNegInt(row?.orderCreateIpLimit, ORDER_DEFAULTS.ORDER_CREATE_IP)
          : action === "ORDER_CREATE_USER"
            ? nonNegInt(row?.orderCreateUserLimit, ORDER_DEFAULTS.ORDER_CREATE_USER)
            : nonNegInt(row?.orderCreateDeviceLimit, ORDER_DEFAULTS.ORDER_CREATE_DEVICE);
      return { limit, windowMs };
    } catch {
      return {
        limit: ORDER_DEFAULTS[action],
        windowMs: ORDER_DEFAULTS.windowMinutes * 60_000,
      };
    }
  }
  return STATIC_POLICY[action];
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashSecurityRateKey(action: SecurityRateAction, identity: string) {
  const payload = new TextEncoder().encode(`security-rate:${action}:${identity}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", payload)));
}

export function securityRateIdentity(clientIp: string | null | undefined, extra?: string | null) {
  const ip = clientIp?.trim() || "unknown";
  return extra?.trim() ? `ip:${ip}|${extra.trim().toLowerCase()}` : `ip:${ip}`;
}

export async function enforceSecurityRateLimit(
  database: D1Database,
  input: {
    action: SecurityRateAction;
    clientIp?: string | null;
    extra?: string | null;
    now?: Date;
  },
) {
  const policy = await resolvePolicy(database, input.action);
  // 0 = disabled for checkout soft limits
  if (policy.limit <= 0) return;

  const now = input.now?.getTime() ?? Date.now();
  const expiresAt = now + policy.windowMs;
  const identity = securityRateIdentity(input.clientIp, input.extra);
  const keyHash = await hashSecurityRateKey(input.action, identity);

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

  const count = Number(result?.requestCount ?? 1);
  if (count > policy.limit) {
    appError("RATE_LIMITED");
  }
}

export async function checkSecurityRateLimit(
  database: D1Database,
  input: {
    action: SecurityRateAction;
    clientIp?: string | null;
    extra?: string | null;
    now?: Date;
  },
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  try {
    await enforceSecurityRateLimit(database, input);
    return { allowed: true, retryAfterSec: 0 };
  } catch (cause) {
    if (cause instanceof Error && (cause.message === "RATE_LIMITED" || (cause as { code?: string }).code === "RATE_LIMITED")) {
      const policy = await resolvePolicy(database, input.action);
      return { allowed: false, retryAfterSec: Math.ceil(policy.windowMs / 1000) };
    }
    throw cause;
  }
}
