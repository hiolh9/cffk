import {
  CURRENCY_COOKIE,
  currencyFromCountry,
  DEFAULT_STORE_CURRENCY,
  isStoreCurrency,
  type StoreCurrency,
} from "@/lib/currency";

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

/**
 * Resolve preferred store currency.
 * Priority: explicit cookie (user choice) → CF-IPCountry hint → MYR.
 */
export function resolvePreferredCurrency(input: {
  cookieHeader?: string | null;
  cfCountry?: string | null;
  enabled?: StoreCurrency[] | null;
}): StoreCurrency {
  const cookies = parseCookieHeader(input.cookieHeader ?? null);
  const fromCookie = cookies[CURRENCY_COOKIE];
  if (isStoreCurrency(fromCookie)) {
    if (!input.enabled || input.enabled.includes(fromCookie)) return fromCookie;
  }

  const fromIp = currencyFromCountry(input.cfCountry);
  if (!input.enabled || input.enabled.includes(fromIp)) return fromIp;

  if (input.enabled?.length) return input.enabled[0]!;
  return DEFAULT_STORE_CURRENCY;
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
