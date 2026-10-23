import { desc, eq } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin } from "@/server/telefunc-context";
import { riskUserScore, siteSetting } from "@/database/drizzle/schema";
import {
  listRiskBlacklist,
  upsertRiskBlacklist,
  disableRiskBlacklist,
  type RiskBlacklistKind,
} from "@/server/security/blacklist";
import { listRecentSightings, listSharedFingerprints } from "@/server/security/device-sighting";
import { appError } from "@/lib/app-error";

async function internalOnGetRiskDashboard() {
  const { database, db } = requireAdmin();

  const thresholds: Record<string, number> = {
    behaviorScoreReview: 50,
    behaviorScoreBlock: 80,
    maxDevicesPerUser: 3,
    maxIpsPerUser: 5,
    behaviorWindowHours: 24,
  };
  try {
    const [row] = await db.select().from(siteSetting).where(eq(siteSetting.id, 1)).limit(1);
    if (row) {
      const r = row as Record<string, unknown>;
      for (const k of Object.keys(thresholds)) {
        const n = Number(r[k]);
        if (Number.isFinite(n) && n >= 0) thresholds[k] = Math.floor(n);
      }
    }
  } catch {
    /* defaults */
  }

  let scores: Array<{
    userId: string;
    score: number;
    reasonsJson: string | null;
    updatedAt: Date | number | null;
  }> = [];
  try {
    scores = await db
      .select({
        userId: riskUserScore.userId,
        score: riskUserScore.score,
        reasonsJson: riskUserScore.reasonsJson,
        updatedAt: riskUserScore.updatedAt,
      })
      .from(riskUserScore)
      .orderBy(desc(riskUserScore.score), desc(riskUserScore.updatedAt))
      .limit(50);
  } catch {
    scores = [];
  }

  let sightings: Awaited<ReturnType<typeof listRecentSightings>> = [];
  let sharedFp: Awaited<ReturnType<typeof listSharedFingerprints>> = [];
  let blacklist: Awaited<ReturnType<typeof listRiskBlacklist>> = [];
  try {
    sightings = await listRecentSightings(database, 40);
  } catch {
    sightings = [];
  }
  try {
    sharedFp = await listSharedFingerprints(database, 2, 20);
  } catch {
    sharedFp = [];
  }
  try {
    blacklist = await listRiskBlacklist(database, 100);
  } catch {
    blacklist = [];
  }

  const highRisk = scores.filter((s) => s.score >= thresholds.behaviorScoreReview).length;
  const blockedBand = scores.filter((s) => s.score >= thresholds.behaviorScoreBlock).length;

  return {
    thresholds,
    summary: {
      trackedUsers: scores.length,
      highRisk,
      blockedBand,
      sightings: sightings.length,
      sharedFingerprints: sharedFp.length,
      blacklist: blacklist.length,
    },
    scores,
    sightings,
    sharedFp,
    blacklist,
  };
}

async function internalOnUpsertRiskBlacklist(input: {
  kind: RiskBlacklistKind;
  value: string;
  reason?: string | null;
  enabled?: boolean;
}) {
  const { database } = requireAdmin();
  return upsertRiskBlacklist(database, input);
}

async function internalOnDisableRiskBlacklist(input: { id: number }) {
  const { database } = requireAdmin();
  if (!Number.isFinite(input.id) || input.id < 1) appError("RISK_BLACKLIST_INVALID");
  return disableRiskBlacklist(database, Math.floor(input.id));
}

export const onGetRiskDashboard = telefuncAction(internalOnGetRiskDashboard);
export const onUpsertRiskBlacklist = telefuncAction(internalOnUpsertRiskBlacklist);
export const onDisableRiskBlacklist = telefuncAction(internalOnDisableRiskBlacklist);
