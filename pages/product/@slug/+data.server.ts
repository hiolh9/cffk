import { render } from "vike/abort";
import { env } from "cloudflare:workers";
import { getPublicProductDetail } from "@/server/catalog/public";
import { getEnabledPaymentProviders } from "@/server/payment/config";
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

export async function data(pageContext: PageContextServer & { routeParams: { slug: string } }) {
  return withServerDataErrorHandling("page data: product", pageContext, async () => {
    const preferred = resolvePreferredCurrency({
      cookieHeader: headerGet(pageContext, "cookie"),
      cfCountry: headerGet(pageContext, "cf-ipcountry"),
    });
    const product = await getPublicProductDetail(env.DB, pageContext.routeParams.slug, preferred);
    if (!product) throw render(404);
    const paymentProviders = await getEnabledPaymentProviders(env.DB);
    return { ...product, paymentProviders };
  });
}
