import { Hono } from "hono";
import { getApp as vike } from "vike-cloudflare/hono";
import { betterAuthHandler, betterAuthSessionMiddleware } from "./auth/handler";
import { telefuncHandler } from "./telefunc-handler";
import { reportUnexpectedRequestError } from "./error-handling";
import { applySecurityHeaders } from "./security/headers";
import { corsRejectResponse, isAllowedBrowserOrigin } from "./security/cors";
import { PaymentCallbackService, paymentCallbackResponse } from "./payment/callback-service";
import { handleDujiaoSupplierCallback } from "./supplier/callback";
import { registerMediaRoutes } from "./media/routes";
import { registerSeoRoutes } from "./seo/routes";
import { getTurnstileConfig } from "./security/turnstile";
import { attachLocaleRewrite } from "./i18n/locale-rewrite";

function getApp() {
  const app = new Hono<{ Bindings: Env }>();
  attachLocaleRewrite(app);

  // Block cross-site browser calls to app APIs (payment notify is server-to-server, no Origin or gateway Origin)
  app.use("*", async (context, next) => {
    const path = context.req.path;
    const isBrowserApi =
      path.startsWith("/_telefunc")
      || path.startsWith("/api/") && !path.startsWith("/api/payments/")
      && !path.startsWith("/api/supplier/");
    if (isBrowserApi && !isAllowedBrowserOrigin(context.req.raw)) {
      return corsRejectResponse();
    }
    await next();
    applySecurityHeaders(context.res.headers);
  });

  app.onError(async (error, context) => {
    await reportUnexpectedRequestError("hono", error, context.req.raw);
    if (context.req.path.startsWith("/api/payments/")) return context.text("failure", 500);
    if (context.req.path.startsWith("/api/")) {
      return context.json({ code: "INTERNAL_ERROR", message: "接口异常，请稍后重试。", data: null }, 500);
    }
    return context.text("Internal Server Error", 500);
  });

  for (const [provider, path] of [
    ["ALIPAY", "/api/payments/alipay/notify"],
    ["EPAY", "/api/payments/epay/notify"],
  ] as const) {
    app.post(path, async (context) => {
      const service = new PaymentCallbackService(context.env.DB, context.env as unknown as Record<string, unknown>);
      const contentType = context.req.header("content-type") ?? "";
      let payload: Record<string, string> = {};
      const rawBody = await context.req.text();
      if (contentType.includes("application/json")) {
        try {
          const parsed = JSON.parse(rawBody) as Record<string, unknown>;
          payload = Object.fromEntries(
            Object.entries(parsed).map(([k, v]) => [k, v == null ? "" : String(v)]),
          );
        } catch {
          payload = {};
        }
      } else {
        const form = new URLSearchParams(rawBody);
        payload = Object.fromEntries(form.entries());
      }
      const result = await service.handle(provider, {
        payload,
        rawBody,
        headers: context.req.raw.headers,
      });
      const response = paymentCallbackResponse(result.ok);
      return context.body(response.body, response.status, { "content-type": response.contentType });
    });
  }

  app.post("/api/supplier/dujiao/:accountId/callback", (context) =>
    handleDujiaoSupplierCallback(context.env.DB, context.req.param("accountId"), context.req.raw),
  );
  registerMediaRoutes(app);
  registerSeoRoutes(app);
  app.get("/api/security/turnstile", (context) => {
    const config = getTurnstileConfig(context.env);
    return context.json({ enabled: config.enabled, siteKey: config.enabled ? config.siteKey : null });
  });
  vike(app, [betterAuthSessionMiddleware, betterAuthHandler, telefuncHandler]);
  return app;
}
export const app = getApp();
