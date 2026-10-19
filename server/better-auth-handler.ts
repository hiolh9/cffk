import {
  enhance,
  type RuntimeAdapter,
  type UniversalHandler,
  type UniversalMiddleware,
} from "@universal-middleware/core";
import { betterAuth } from "better-auth";
import { getAuthConfig } from "./better-auth";
import { resolveAuthOrigin, rewriteRequestOrigin, withAuthNoStore } from "./auth-origin";
import { eq, sql } from "drizzle-orm";
import { schema } from "../database/drizzle/schema";
import { getDrizzleDb } from "../database/drizzle";
import { hasRoot } from "./admin";
import { checkSecurityRateLimit } from "./security/rate-limit";

function getAuth(runtime: RuntimeAdapter, publicOrigin?: string) {
  return betterAuth(getAuthConfig(runtime, publicOrigin));
}

export async function getRequestSession(request: Request, runtime: RuntimeAdapter) {
  const publicOrigin = await resolveAuthOrigin(request, runtime);
  const authRequest = rewriteRequestOrigin(request, publicOrigin);
  return getAuth(runtime, publicOrigin).api.getSession({ headers: authRequest.headers });
}

export const betterAuthSessionMiddleware = enhance(
  async (request, context, runtime) => {
    try {
      const data = await getRequestSession(request, runtime);
      const userId = data?.user?.id;
      const [account] = userId
        ? await getDrizzleDb(runtime)
            .select({
              disabledAt: schema.user.disabledAt,
              rootUserId: schema.adminBootstrap.userId,
            })
            .from(schema.user)
            .leftJoin(schema.adminBootstrap, eq(schema.adminBootstrap.userId, schema.user.id))
            .where(eq(schema.user.id, userId))
            .limit(1)
        : [];
      const isDisabled = Boolean(account?.disabledAt);
      return {
        ...context,
        user: isDisabled ? null : data?.user ?? null,
        isAdmin: !isDisabled && account?.rootUserId === userId,
      };
    } catch (error) {
      console.debug("betterAuthSessionMiddleware:", error);
      return {
        ...context,
        user: null,
        isAdmin: false,
      };
    }
  },
  {
    name: "my-app:better-auth-middleware",
    immutable: false,
  },
);

export const betterAuthHandler = enhance(
  async (request, _context, runtime) => {
    const publicOrigin = await resolveAuthOrigin(request, runtime);
    const authRequest = rewriteRequestOrigin(request, publicOrigin);
    const authPath = new URL(authRequest.url).pathname;
    const isEmailSignUp = authRequest.method === "POST" && authPath.endsWith("/sign-up/email");

    const clientIp = request.headers.get("CF-Connecting-IP");
    const db = (runtime as { env?: { DB?: D1Database } }).env?.DB;
    const authPathLower = authPath.toLowerCase();
    if (db && authRequest.method === "POST") {
      let rateAction: "AUTH_SIGN_IN" | "AUTH_SIGN_UP" | "AUTH_PASSWORD_RESET" | "AUTH_2FA" | null = null;
      if (authPathLower.endsWith("/sign-in/email") || authPathLower.includes("/sign-in/")) rateAction = "AUTH_SIGN_IN";
      else if (authPathLower.endsWith("/sign-up/email") || authPathLower.includes("/sign-up/")) rateAction = "AUTH_SIGN_UP";
      else if (authPathLower.includes("forget-password") || authPathLower.includes("reset-password") || authPathLower.includes("request-password")) rateAction = "AUTH_PASSWORD_RESET";
      else if (authPathLower.includes("two-factor") || authPathLower.includes("2fa")) rateAction = "AUTH_2FA";
      if (rateAction) {
        const check = await checkSecurityRateLimit(db, { action: rateAction, clientIp });
        if (!check.allowed) {
          return withAuthNoStore(Response.json(
            { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." },
            { status: 429, headers: { "Retry-After": String(check.retryAfterSec) } },
          ));
        }
      }
    }

    if (isEmailSignUp && !(await hasRoot(runtime))) {
      return withAuthNoStore(Response.json(
        { code: "SIGN_UP_UNAVAILABLE", message: "Sign-up is currently unavailable." },
        { status: 503 },
      ));
    }

    if (authRequest.method === "POST" && authPath.endsWith("/sign-in/email")) {
      const body = await authRequest.clone().json().catch(() => null) as { email?: unknown } | null;
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      const isAdminLogin = authRequest.headers.get("x-cffk-admin-login") === "1";
      if (email) {
        const [account] = await getDrizzleDb(runtime)
          .select({ disabledAt: schema.user.disabledAt, rootUserId: schema.adminBootstrap.userId })
          .from(schema.user)
          .leftJoin(schema.adminBootstrap, eq(schema.adminBootstrap.userId, schema.user.id))
          .where(sql`lower(${schema.user.email}) = ${email}`)
          .limit(1);
        if (isAdminLogin && (!account || account.disabledAt || !account.rootUserId)) {
          return withAuthNoStore(Response.json(
            { code: "INVALID_ADMIN_CREDENTIALS", message: "Invalid credentials." },
            { status: 401 },
          ));
        }
        if (!isAdminLogin && account?.rootUserId) {
          return withAuthNoStore(Response.json(
            { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
            { status: 401 },
          ));
        }
        if (account?.disabledAt) {
          return withAuthNoStore(Response.json({ code: "ACCOUNT_DISABLED", message: "Account is disabled." }, { status: 403 }));
        }
      }
    }

    return withAuthNoStore(await getAuth(runtime, publicOrigin).handler(authRequest));
  },
  {
    name: "my-app:better-auth-handler",
    path: "/api/auth/**",
    method: ["GET", "POST"],
    immutable: false,
  },
) satisfies UniversalHandler;
