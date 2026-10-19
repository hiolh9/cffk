import { getContext } from "telefunc";
import { createDrizzleDb } from "@/database/drizzle";
import { appError } from "@/lib/app-error";
import { eq } from "drizzle-orm";
import { user } from "@/database/drizzle/schema";

export type TelefuncContext = {
  env?: Record<string, unknown> & { DB?: D1Database };
  user?: { id: string } | null;
  isAdmin?: boolean;
  clientIp?: string | null;
};

export function requireDatabase() {
  const context = getContext<TelefuncContext>();
  if (!context.env?.DB) appError("DATABASE_UNAVAILABLE");
  return { context, database: context.env.DB, runtime: context.env, db: createDrizzleDb(context.env.DB) };
}

export function requireUser() {
  const result = requireDatabase();
  if (!result.context.user) appError("AUTH_REQUIRED");
  return { ...result, user: result.context.user };
}

export function assertAdminAccess(user: { id: string } | null | undefined, isAdmin: boolean | undefined) {
  if (!user) appError("AUTH_REQUIRED");
  if (!isAdmin) appError("ADMIN_ACCESS_REQUIRED");
  return user;
}

/** Basic admin gate (root only). Prefer requireAdminSecure for sensitive mutations. */
export function requireAdmin() {
  const result = requireUser();
  const adminUser = assertAdminAccess(result.user, result.context.isAdmin);
  return { ...result, user: adminUser, adminUserId: adminUser.id };
}

/**
 * Admin gate that also requires two-factor authentication.
 * Security settings page should keep using requireAdmin() so admins can enable 2FA.
 */
export async function requireAdminSecure() {
  const result = requireAdmin();
  const [row] = await result.db
    .select({ twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, result.adminUserId))
    .limit(1);
  if (!row?.twoFactorEnabled) {
    appError("ADMIN_2FA_REQUIRED");
  }
  return result;
}
