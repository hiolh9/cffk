import {
  CURRENCY_COOKIE,
  currencyFromCountry,
  DEFAULT_STORE_CURRENCY,
  isStoreCurrency,
  type StoreCurrency,
} from "@/lib/currency";
import {
  parseRegionsCheckoutConfig,
  resolveCurrencyForRegion,
  resolveRegion,
  type RegionsCheckoutConfig,
} from "@/lib/region/config";

function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function parseEnabledCurrenciesJson(raw: string | null | undefined): StoreCurrency[] | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const list = parsed.filter((x): x is StoreCurrency => typeof x === "string" && isStoreCurrency(x));
    return list.length ? list : null;
  } catch {
    return null;
  }
}

/**
 * Resolve preferred store currency.
 * With regionsConfig: region rules → cookie (if allowed) → displayCurrency.
 * Without: cookie → CF-IPCountry → MYR (legacy).
 */
export function resolvePreferredCurrency(input: {
  cookieHeader?: string | null;
  cfCountry?: string | null;
  enabled?: StoreCurrency[] | null;
  regionsConfigJson?: string | null;
  regionsConfig?: RegionsCheckoutConfig | null;
}): StoreCurrency {
  const cookies = parseCookieHeader(input.cookieHeader ?? null);
  const fromCookie = cookies[CURRENCY_COOKIE];

  const config =
    input.regionsConfig ??
    (input.regionsConfigJson != null ? parseRegionsCheckoutConfig(input.regionsConfigJson) : null);

  if (config) {
    const region = resolveRegion(config, input.cfCountry);
    const resolved = resolveCurrencyForRegion({
      region,
      cookieCurrency: fromCookie,
    });
    if (input.enabled && !input.enabled.includes(resolved)) {
      return input.enabled[0] ?? DEFAULT_STORE_CURRENCY;
    }
    return resolved;
  }

  if (isStoreCurrency(fromCookie)) {
    if (!input.enabled || input.enabled.includes(fromCookie)) return fromCookie;
  }

  const fromIp = currencyFromCountry(input.cfCountry);
  if (!input.enabled || input.enabled.includes(fromIp)) return fromIp;

  if (input.enabled?.length) return input.enabled[0]!;
  return DEFAULT_STORE_CURRENCY;
}

export function resolveCheckoutContext(input: {
  cookieHeader?: string | null;
  cfCountry?: string | null;
  regionsConfigJson?: string | null;
}) {
  const config = parseRegionsCheckoutConfig(input.regionsConfigJson);
  const region = resolveRegion(config, input.cfCountry);
  const cookies = parseCookieHeader(input.cookieHeader ?? null);
  const currency = resolveCurrencyForRegion({
    region,
    cookieCurrency: cookies[CURRENCY_COOKIE],
  });
  return { config, region, currency };
}
