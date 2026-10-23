import { and, eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { riskBlacklist } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";

export type RiskBlacklistKind = "IP" | "USER" | "DEVICE" | "FP";

function normalize(kind: RiskBlacklistKind, value: string) {
  const v = value.trim();
  if (kind === "IP" || kind === "FP") return v.toLowerCase();
  if (kind === "DEVICE") return v;
  return v;
}

export async function enforceRiskBlacklist(
  database: D1Database,
  input: {
    clientIp?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    fpHash?: string | null;
  },
) {
  const checks: Array<{ kind: RiskBlacklistKind; value: string }> = [];
  if (input.clientIp?.trim() && input.clientIp.trim() !== "unknown") {
    checks.push({ kind: "IP", value: normalize("IP", input.clientIp) });
  }
  if (input.userId?.trim()) {
    checks.push({ kind: "USER", value: normalize("USER", input.userId) });
  }
  if (input.deviceId?.trim()) {
    checks.push({ kind: "DEVICE", value: normalize("DEVICE", input.deviceId) });
  }
  if (input.fpHash?.trim() && /^[a-f0-9]{16,64}$/i.test(input.fpHash.trim())) {
    checks.push({ kind: "FP", value: normalize("FP", input.fpHash.trim().toLowerCase()) });
  }
  if (!checks.length) return;

  try {
    const db = createDrizzleDb(database);
    for (const c of checks) {
      const [row] = await db
        .select({ id: riskBlacklist.id })
        .from(riskBlacklist)
        .where(and(eq(riskBlacklist.kind, c.kind), eq(riskBlacklist.value, c.value), eq(riskBlacklist.enabled, true)))
        .limit(1);
      if (row) appError("RISK_BLOCKED");
    }
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause && (cause as { code: string }).code === "RISK_BLOCKED") {
      throw cause;
    }
    // Table missing before migration: skip rather than break checkout.
  }
}

export async function listRiskBlacklist(database: D1Database, limit = 100) {
  const db = createDrizzleDb(database);
  return db
    .select()
    .from(riskBlacklist)
    .where(eq(riskBlacklist.enabled, true))
    .limit(Math.min(Math.max(limit, 1), 500));
}

export async function upsertRiskBlacklist(
  database: D1Database,
  input: { kind: RiskBlacklistKind; value: string; reason?: string | null; enabled?: boolean },
) {
  const kind = input.kind;
  if (!["IP", "USER", "DEVICE", "FP"].includes(kind)) appError("RISK_BLACKLIST_INVALID");
  const value = normalize(kind, input.value);
  if (!value || value.length > 256) appError("RISK_BLACKLIST_INVALID");
  const db = createDrizzleDb(database);
  const now = new Date();
  const enabled = input.enabled !== false;
  const [existing] = await db
    .select({ id: riskBlacklist.id })
    .from(riskBlacklist)
    .where(and(eq(riskBlacklist.kind, kind), eq(riskBlacklist.value, value)))
    .limit(1);
  if (existing) {
    await db
      .update(riskBlacklist)
      .set({ reason: input.reason?.trim() || null, enabled, updatedAt: now })
      .where(eq(riskBlacklist.id, existing.id));
    return { id: existing.id };
  }
  const [row] = await db
    .insert(riskBlacklist)
    .values({ kind, value, reason: input.reason?.trim() || null, enabled, createdAt: now, updatedAt: now })
    .returning({ id: riskBlacklist.id });
  return { id: row!.id };
}

export async function disableRiskBlacklist(database: D1Database, id: number) {
  const db = createDrizzleDb(database);
  await db
    .update(riskBlacklist)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(riskBlacklist.id, id));
  return { ok: true as const };
}
