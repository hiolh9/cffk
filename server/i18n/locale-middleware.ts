import type { Context, Hono, Next } from "hono";
import { LOCALE_COOKIE, stripLocalePrefix } from "@/lib/i18n/locale-path";

type AppEnv = { Bindings: Record<string, unknown> & { DB: D1Database } };

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function englishLocaleCookie(): string {
  return `${LOCALE_COOKIE}=en-US; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Register early on the Hono app:
 * /en and /en/* are re-fetched on the same app with the prefix stripped,
 * so Vike keeps a single page tree while English has a stable SEO path.
 */
export function registerEnglishLocaleRewrite(app: Hono<AppEnv>) {
  app.use("*", async (context: Context<AppEnv>, next: Next) => {
    const { locale, path: stripped } = stripLocalePrefix(context.req.path);
    if (locale !== "en") {
      await next();
      return;
    }

    // Do not rewrite API / telefunc / static asset paths if they ever appear under /en
    if (
      stripped.startsWith("/api/")
      || stripped.startsWith("/_telefunc")
      || stripped.startsWith("/assets/")
      || stripped.startsWith("/media/")
    ) {
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
      (init as { duplex?: string }).duplex = "half";
    }

    const rewritten = new Request(url.toString(), init);
    const response = await app.fetch(rewritten, context.env, context.executionCtx);
    const outHeaders = new Headers(response.headers);
    outHeaders.append("Set-Cookie", englishLocaleCookie());
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  });
}
