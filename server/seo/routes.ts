import type { Context, Hono } from "hono";
import { getPublicCatalog } from "@/server/catalog/public";
import { getSiteSettings } from "@/server/site/public-settings";
import { env } from "@/server/env";

type AppBindings = { Bindings: Record<string, unknown> & { DB: D1Database } };

const STATIC_PATHS = ["/", "/privacy", "/terms", "/sales"] as const;

/** Escape XML special chars using numeric entities (avoids &-entity corruption). */
function escapeXml(value: string) {
  return value
    .replace(/&/g, "&#38;")
    .replace(/</g, "&#60;")
    .replace(/>/g, "&#62;")
    .replace(/"/g, "&#34;")
    .replace(/'/g, "&#39;");
}

async function resolvePublicOrigin(context: Context<AppBindings>): Promise<string> {
  try {
    const settings = await getSiteSettings(context.env.DB);
    if (settings.siteUrl) {
      const url = new URL(settings.siteUrl);
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    }
  } catch {
    /* fall through */
  }
  try {
    return new URL(context.req.url).origin;
  } catch {
    return "https://localhost";
  }
}

function adminDisallowPath(): string | null {
  const raw = (env.ADMIN_PATH || "").trim().replace(/^\/+|\/+$/g, "");
  if (!raw || raw.includes("..") || raw.includes("//")) return null;
  return `/${raw}`;
}

export function registerSeoRoutes(app: Hono<AppBindings>) {
  app.get("/robots.txt", async (context) => {
    const origin = await resolvePublicOrigin(context);
    const adminPath = adminDisallowPath();
    const lines = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /setup",
      "Disallow: /order",
      "Disallow: /checkout",
      "Disallow: /payment-result",
      "Disallow: /two-factor",
      "Disallow: /login",
      "Disallow: /signup",
      "Disallow: /account",
      "Disallow: /auth/",
      "Disallow: /api/",
      "Disallow: /_telefunc",
    ];
    if (adminPath) lines.push(`Disallow: ${adminPath}`);
    lines.push("", `Sitemap: ${origin}/sitemap.xml`, "");
    return context.text(lines.join("\n"), 200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    });
  });

  app.get("/sitemap.xml", async (context) => {
    const origin = (await resolvePublicOrigin(context)).replace(/\/$/, "");
    const now = new Date().toISOString();
    const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = STATIC_PATHS.map(
      (path) => ({
        loc: path === "/" ? `${origin}/` : `${origin}${path}`,
        lastmod: now,
        changefreq: path === "/" ? "daily" : "monthly",
        priority: path === "/" ? "1.0" : "0.5",
      }),
    );

    try {
      const catalog = await getPublicCatalog(context.env.DB);
      for (const product of catalog.products) {
        if (!product.slug) continue;
        urls.push({
          loc: `${origin}/product/${encodeURIComponent(product.slug)}`,
          lastmod: now,
          changefreq: "daily",
          priority: "0.8",
        });
      }
    } catch {
      /* still return static URLs */
    }

    const body = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...urls.map((entry) => {
        const parts = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
        if (entry.lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
        if (entry.changefreq) parts.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
        if (entry.priority) parts.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
        parts.push(`  </url>`);
        return parts.join("\n");
      }),
      `</urlset>`,
      "",
    ].join("\n");

    return context.text(body, 200, {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    });
  });
}
