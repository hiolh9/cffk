import { env } from "cloudflare:workers";
import { getPublicCatalog } from "@/server/catalog/public";
import { withServerDataErrorHandling } from "@/server/error-handling";
import { resolvePreferredCurrency } from "@/server/currency/resolve";
import type { PageContextServer } from "vike/types";

export type Data = Awaited<ReturnType<typeof data>>;

function headerGet(pageContext: PageContextServer, name: string): string | null {
  const headers = (pageContext as { headers?: Headers | Record<string, string> }).headers;
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name);
  const key = Object.keys(headers as Record<string, string>).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? (headers as Record<string, string>)[key] ?? null : null;
}

export async function data(pageContext: PageContextServer) {
  return withServerDataErrorHandling("page data: index", pageContext, () => {
    const preferred = resolvePreferredCurrency({
      cookieHeader: headerGet(pageContext, "cookie"),
      cfCountry: headerGet(pageContext, "cf-ipcountry"),
    });
    return getPublicCatalog(env.DB, preferred);
  });
}
