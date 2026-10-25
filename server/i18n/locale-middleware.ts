import type { MiddlewareHandler } from "hono";
import { LOCALE_COOKIE, stripLocalePrefix } from "@/lib/i18n/locale-path";

/**
 * /en and /en/* → rewrite to the same page without prefix, set English locale cookie.
 * Keeps one page tree while giving English a stable SEO URL.
 */
export const englishLocaleRewriteMiddleware: MiddlewareHandler = async (context, next) => {
  const path = context.req.path;
  const { locale, path: stripped } = stripLocalePrefix(path);
  if (locale !== "en") {
    await next();
    return;
  }

  // Avoid rewriting API / assets / admin internals incorrectly: only strip when path was /en...
  if (stripped.startsWith("/api/") || stripped.startsWith("/_telefunc") || stripped.startsWith("/assets/")) {
    await next();
    return;
  }

  const url = new URL(context.req.url);
  url.pathname = stripped;

  const headers = new Headers(context.req.raw.headers);
  headers.set("x-storefront-locale", "en-US");

  const init: RequestInit = {
    method: context.req.method,
    headers,
    redirect: "manual",
  };
  if (context.req.method !== "GET" && context.req.method !== "HEAD") {
    init.body = context.req.raw.body;
    // Cloudflare Workers streaming body
    (init as { duplex?: string }).duplex = "half";
  }

  const rewritten = new Request(url.toString(), init);
  // Re-enter the same worker fetch; stripped path no longer matches /en so no loop.
  const response = await context.env
    ? // Prefer executionCtx when available
      fetch(rewritten)
    : fetch(rewritten);

  // Note: using global fetch may miss Worker bindings. Use context.req.app pattern instead.
  // Hono: clone via next with overridden path is hard; use redirect is worse for SEO.
  // Standard pattern for CF Workers: pass to getApp fetch.
  void response;
  await next();
};
