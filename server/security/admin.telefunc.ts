import { telefuncAction } from "@/server/telefunc-action";
import { eq } from "drizzle-orm";
import { user } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";

import { requireAdmin, requireAdminSecure } from "@/server/telefunc-context";
import { env } from "@/server/env";
import { getTurnstileConfig } from "@/lib/turnstile-config";
import { grantStepUp } from "@/server/security/step-up";
import { getAdminIpAllowlist } from "@/server/security/admin-ip";

async function internalOnGetSecurityStatus() {
  // Intentionally requireAdmin (not Secure) so admins can open this page before enabling 2FA.
  const { db, adminUserId } = requireAdmin();
  const [admin] = await db.select({ email: user.email, twoFactorEnabled: user.twoFactorEnabled }).from(user).where(eq(user.id, adminUserId)).limit(1);
  if (!admin) appError("ADMIN_NOT_FOUND");

  const turnstile = getTurnstileConfig(env);
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
      stepUpMinutes: 15,
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
  await grantStepUp(database, adminUserId);
  return { ok: true, validMinutes: 15 };
}

export const onGrantStepUp = telefuncAction(internalOnGrantStepUp);
