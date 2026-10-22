import { telefuncAction } from "@/server/telefunc-action";
import { eq } from "drizzle-orm";
import { user } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";

import { requireAdmin, requireAdminSecure } from "@/server/telefunc-context";
import { env } from "@/server/env";
import { getTurnstileConfig } from "@/lib/turnstile-config";
import { grantStepUp, getStepUpMinutes } from "@/server/security/step-up";
import { getAdminIpAllowlist } from "@/server/security/admin-ip";
import { getIpMultiAccountPolicy } from "@/server/security/ip-multi-account";

async function internalOnGetSecurityStatus() {
  const { database, db, adminUserId } = requireAdmin();
  const [admin] = await db.select({ email: user.email, twoFactorEnabled: user.twoFactorEnabled }).from(user).where(eq(user.id, adminUserId)).limit(1);
  if (!admin) appError("ADMIN_NOT_FOUND");

  const turnstile = getTurnstileConfig(env);
  const [stepUpMinutes, ipPolicy] = await Promise.all([
    getStepUpMinutes(database),
    getIpMultiAccountPolicy(database),
  ]);

  return {
    email: admin.email,
    twoFactorEnabled: admin.twoFactorEnabled,
    policy: {
      adminTwoFactorRequired: true,
      authRateLimitEnabled: true,
      securityHeadersEnabled: true,
      loginLockoutEnabled: true,
      credentialsEncryptedAtRest: true,
      adminIpAllowlistConfigured: getAdminIpAllowlist().length > 0,
      sessionHours: 8,
      stepUpMinutes,
      ipMultiAccountMaxUsers: ipPolicy.maxDistinctUsers,
      ipMultiAccountWindowMinutes: ipPolicy.windowMinutes,
    },
    turnstile: {
      siteKey: turnstile.siteKey,
      enabled: turnstile.enabled,
      siteKeyConfigured: Boolean(turnstile.siteKey),
      secretConfigured: Boolean(turnstile.secretKey),
    },
  };
}

export const onGetSecurityStatus = telefuncAction(internalOnGetSecurityStatus);

async function internalOnGrantStepUp() {
  const { database, adminUserId } = await requireAdminSecure();
  const result = await grantStepUp(database, adminUserId);
  return { ok: true, validMinutes: result.validMinutes };
}

export const onGrantStepUp = telefuncAction(internalOnGrantStepUp);
