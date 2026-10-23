import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { riskDeviceSighting } from "@/database/drizzle/schema";

/**
 * Persist user ↔ device ↔ IP ↔ fingerprint observations.
 * Best-effort: failures must not break checkout.
 */
export async function recordDeviceSighting(
  database: D1Database,
  input: {
    userId: string;
    deviceId: string;
    clientIp?: string | null;
    fpHash?: string | null;
  },
) {
  const userId = input.userId?.trim();
  const deviceId = input.deviceId?.trim();
  if (!userId || !deviceId) return;

  const now = new Date();
  const ip = input.clientIp?.trim() && input.clientIp.trim() !== "unknown" ? input.clientIp.trim() : null;
  const fpHash = input.fpHash?.trim() && /^[a-f0-9]{16,64}$/i.test(input.fpHash.trim())
    ? input.fpHash.trim().toLowerCase()
    : null;

  try {
    const db = createDrizzleDb(database);
    const [existing] = await db
      .select({ id: riskDeviceSighting.id, sightingCount: riskDeviceSighting.sightingCount })
      .from(riskDeviceSighting)
      .where(and(eq(riskDeviceSighting.userId, userId), eq(riskDeviceSighting.deviceId, deviceId)))
      .limit(1);

    if (existing) {
      await db
        .update(riskDeviceSighting)
        .set({
          clientIp: ip ?? undefined,
          fpHash: fpHash ?? undefined,
          lastSeenAt: now,
          sightingCount: (existing.sightingCount ?? 1) + 1,
        })
        .where(eq(riskDeviceSighting.id, existing.id));
    } else {
      await db.insert(riskDeviceSighting).values({
        userId,
        deviceId,
        fpHash,
        clientIp: ip,
        firstSeenAt: now,
        lastSeenAt: now,
        sightingCount: 1,
      });
    }
  } catch {
    // Table may not exist before migration.
  }
}

export async function countUserDevices(
  database: D1Database,
  userId: string,
  since: Date,
): Promise<number> {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({ n: sql<number>`count(distinct ${riskDeviceSighting.deviceId})` })
      .from(riskDeviceSighting)
      .where(and(eq(riskDeviceSighting.userId, userId), gte(riskDeviceSighting.lastSeenAt, since)));
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function countUserIps(
  database: D1Database,
  userId: string,
  since: Date,
): Promise<number> {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({ n: sql<number>`count(distinct ${riskDeviceSighting.clientIp})` })
      .from(riskDeviceSighting)
      .where(and(eq(riskDeviceSighting.userId, userId), gte(riskDeviceSighting.lastSeenAt, since)));
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function countDeviceUsers(
  database: D1Database,
  deviceId: string,
  since: Date,
): Promise<number> {
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({ n: sql<number>`count(distinct ${riskDeviceSighting.userId})` })
      .from(riskDeviceSighting)
      .where(and(eq(riskDeviceSighting.deviceId, deviceId), gte(riskDeviceSighting.lastSeenAt, since)));
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function countFpUsers(
  database: D1Database,
  fpHash: string,
  since: Date,
): Promise<number> {
  const hash = fpHash?.trim().toLowerCase();
  if (!hash) return 0;
  try {
    const db = createDrizzleDb(database);
    const [row] = await db
      .select({ n: sql<number>`count(distinct ${riskDeviceSighting.userId})` })
      .from(riskDeviceSighting)
      .where(and(eq(riskDeviceSighting.fpHash, hash), gte(riskDeviceSighting.lastSeenAt, since)));
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function listRecentSightings(database: D1Database, limit = 50) {
  const db = createDrizzleDb(database);
  return db
    .select()
    .from(riskDeviceSighting)
    .orderBy(desc(riskDeviceSighting.lastSeenAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function listSharedFingerprints(database: D1Database, minUsers = 2, limit = 30) {
  try {
    const db = createDrizzleDb(database);
    return await db
      .select({
        fpHash: riskDeviceSighting.fpHash,
        userCount: sql<number>`count(distinct ${riskDeviceSighting.userId})`,
        lastSeenAt: sql<number>`max(${riskDeviceSighting.lastSeenAt})`,
      })
      .from(riskDeviceSighting)
      .where(isNotNull(riskDeviceSighting.fpHash))
      .groupBy(riskDeviceSighting.fpHash)
      .having(sql`count(distinct ${riskDeviceSighting.userId}) >= ${minUsers}`)
      .orderBy(sql`count(distinct ${riskDeviceSighting.userId}) desc`)
      .limit(Math.min(Math.max(limit, 1), 100));
  } catch {
    return [];
  }
}
