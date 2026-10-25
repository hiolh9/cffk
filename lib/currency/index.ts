/** Storefront currencies: optional regional list prices, default MYR. No forced FX. */

export const STORE_CURRENCIES = ["MYR", "SGD", "AUD", "JPY", "USD"] as const;
export type StoreCurrency = (typeof STORE_CURRENCIES)[number];

export const DEFAULT_STORE_CURRENCY: StoreCurrency = "MYR";

export const CURRENCY_META: Record<
  StoreCurrency,
  { code: StoreCurrency; decimals: number; symbol: string; label: string }
> = {
  MYR: { code: "MYR", decimals: 2, symbol: "RM", label: "MYR (Malaysia)" },
  SGD: { code: "SGD", decimals: 2, symbol: "S$", label: "SGD (Singapore)" },
  AUD: { code: "AUD", decimals: 2, symbol: "A$", label: "AUD (Australia)" },
  JPY: { code: "JPY", decimals: 0, symbol: "¥", label: "JPY (Japan)" },
  USD: { code: "USD", decimals: 2, symbol: "$", label: "USD (United States)" },
};

/** Cloudflare CF-IPCountry → preferred currency (only a hint). */
export const COUNTRY_CURRENCY: Record<string, StoreCurrency> = {
  MY: "MYR",
  SG: "SGD",
  AU: "AUD",
  JP: "JPY",
  US: "USD",
};

export const CURRENCY_COOKIE = "store_currency";
export const CURRENCY_STORAGE_KEY = "storefront-currency";

export function isStoreCurrency(value: string | null | undefined): value is StoreCurrency {
  return typeof value === "string" && (STORE_CURRENCIES as readonly string[]).includes(value);
}

export function currencyFromCountry(countryCode: string | null | undefined): StoreCurrency {
  if (!countryCode) return DEFAULT_STORE_CURRENCY;
  const code = countryCode.trim().toUpperCase();
  return COUNTRY_CURRENCY[code] ?? DEFAULT_STORE_CURRENCY;
}

/** Parse optional regional minor-unit map. Keys must be store currencies; values integers >= 0. */
export function parseRegionalPricesJson(raw: string | null | undefined): Partial<Record<StoreCurrency, number>> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Partial<Record<StoreCurrency, number>> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isStoreCurrency(key)) continue;
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isSafeInteger(n) || n < 0) continue;
      out[key] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export type ResolvedListPrice = {
  /** Currency actually used for this SKU/product (may fall back to MYR). */
  currency: StoreCurrency;
  /** Integer minor units in `currency`. */
  amountMinor: number;
  /** Formatted major units, e.g. "12.90". */
  price: string;
  /** True when preferred currency had no list price and MYR was used. */
  fellBackToDefault: boolean;
};

/**
 * Resolve display/charge amount.
 * - preferred currency has an optional list price → use it
 * - otherwise use baseMinor in defaultCurrency (MYR)
 * Never invent FX rates.
 */
export function resolveListPrice(input: {
  preferredCurrency: StoreCurrency;
  baseMinor: number;
  defaultCurrency?: StoreCurrency;
  regionalPricesJson?: string | null;
  regionalPrices?: Partial<Record<StoreCurrency, number>>;
}): ResolvedListPrice {
  const defaultCurrency = input.defaultCurrency ?? DEFAULT_STORE_CURRENCY;
  const map = input.regionalPrices ?? parseRegionalPricesJson(input.regionalPricesJson);
  const preferred = input.preferredCurrency;

  if (preferred !== defaultCurrency && typeof map[preferred] === "number") {
    const amountMinor = map[preferred]!;
    return {
      currency: preferred,
      amountMinor,
      price: formatMinor(amountMinor, preferred),
      fellBackToDefault: false,
    };
  }

  if (preferred === defaultCurrency) {
    return {
      currency: defaultCurrency,
      amountMinor: input.baseMinor,
      price: formatMinor(input.baseMinor, defaultCurrency),
      fellBackToDefault: false,
    };
  }

  // No regional price for preferred → default MYR list price
  return {
    currency: defaultCurrency,
    amountMinor: input.baseMinor,
    price: formatMinor(input.baseMinor, defaultCurrency),
    fellBackToDefault: true,
  };
}

export function formatMinor(amountMinor: number, currency: StoreCurrency): string {
  const decimals = CURRENCY_META[currency].decimals;
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) return "-";
  if (decimals === 0) return String(amountMinor);
  const digits = String(amountMinor).padStart(decimals + 1, "0");
  const split = digits.length - decimals;
  return `${digits.slice(0, split)}.${digits.slice(split)}`;
}

export function formatMoney(amountMinor: number, currency: StoreCurrency): string {
  const meta = CURRENCY_META[currency];
  return `${meta.symbol} ${formatMinor(amountMinor, currency)}`;
}

export function formatMoneyFromDisplay(price: string, currency: StoreCurrency): string {
  const meta = CURRENCY_META[currency];
  return `${meta.symbol} ${price}`;
}
