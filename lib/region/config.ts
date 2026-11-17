/**
 * Region → currency → payment method checkout config.
 * Accounting rule: each order locks charge currency + amount; Revenue_MYR uses FX at pay time;
 * settlements reconcile in MYR only (see ACCOUNTING_PLAYBOOK).
 */
import {
  DEFAULT_STORE_CURRENCY,
  isStoreCurrency,
  type StoreCurrency,
  STORE_CURRENCIES,
} from "@/lib/currency";

export type PriceFallback = "MYR" | "USD" | "HIDE";

export type RegionDefinition = {
  code: string;
  label: string;
  countryCodes: string[];
  displayCurrency: StoreCurrency;
  allowedCurrencies: StoreCurrency[];
  allowUserCurrencySwitch: boolean;
  paymentMethodKeys: string[];
  priceFallback: PriceFallback;
  sort: number;
};

export type PaymentPricingMode = "PASS_THROUGH" | "ADD_PERCENT" | "ADD_FIXED";

export type PaymentMethodQuoteConfig = {
  key: string;
  label: string;
  chargeCurrency: StoreCurrency;
  pricingMode: PaymentPricingMode;
  percentBps?: number;
  fixedMinor?: number;
  feeBearer: "CUSTOMER" | "MERCHANT";
  enabled: boolean;
  regionCodes?: string[];
};

export type RegionsCheckoutConfig = {
  schemaVersion: 1;
  regions: RegionDefinition[];
  paymentMethods: PaymentMethodQuoteConfig[];
};

export const DEFAULT_REGIONS_CHECKOUT_CONFIG: RegionsCheckoutConfig = {
  schemaVersion: 1,
  regions: [
    {
      code: "MY",
      label: "Malaysia",
      countryCodes: ["MY"],
      displayCurrency: "MYR",
      allowedCurrencies: ["MYR"],
      allowUserCurrencySwitch: false,
      paymentMethodKeys: ["manual_bank", "billplz_fpx", "billplz_tng"],
      priceFallback: "MYR",
      sort: 10,
    },
    {
      code: "SG",
      label: "Singapore",
      countryCodes: ["SG"],
      displayCurrency: "SGD",
      allowedCurrencies: ["SGD", "USD"],
      allowUserCurrencySwitch: true,
      paymentMethodKeys: ["stripe_card"],
      priceFallback: "USD",
      sort: 20,
    },
    {
      code: "AU",
      label: "Australia",
      countryCodes: ["AU"],
      displayCurrency: "AUD",
      allowedCurrencies: ["AUD"],
      allowUserCurrencySwitch: false,
      paymentMethodKeys: ["stripe_card"],
      priceFallback: "USD",
      sort: 30,
    },
    {
      code: "JP",
      label: "Japan",
      countryCodes: ["JP"],
      displayCurrency: "JPY",
      allowedCurrencies: ["JPY", "USD"],
      allowUserCurrencySwitch: true,
      paymentMethodKeys: ["stripe_card"],
      priceFallback: "USD",
      sort: 40,
    },
    {
      code: "US",
      label: "United States",
      countryCodes: ["US"],
      displayCurrency: "USD",
      allowedCurrencies: ["USD"],
      allowUserCurrencySwitch: false,
      paymentMethodKeys: ["stripe_card"],
      priceFallback: "USD",
      sort: 50,
    },
    {
      code: "REST",
      label: "Rest of world (USD)",
      countryCodes: [],
      displayCurrency: "USD",
      allowedCurrencies: ["USD"],
      allowUserCurrencySwitch: false,
      paymentMethodKeys: ["stripe_card"],
      priceFallback: "USD",
      sort: 1000,
    },
  ],
  paymentMethods: [
    {
      key: "manual_bank",
      label: "Bank transfer (MY)",
      chargeCurrency: "MYR",
      pricingMode: "PASS_THROUGH",
      feeBearer: "MERCHANT",
      enabled: true,
      regionCodes: ["MY"],
    },
    {
      key: "billplz_fpx",
      label: "FPX (Billplz)",
      chargeCurrency: "MYR",
      pricingMode: "ADD_PERCENT",
      percentBps: 150,
      feeBearer: "CUSTOMER",
      enabled: false,
      regionCodes: ["MY"],
    },
    {
      key: "billplz_tng",
      label: "Touch n Go (Billplz)",
      chargeCurrency: "MYR",
      pricingMode: "ADD_PERCENT",
      percentBps: 200,
      feeBearer: "CUSTOMER",
      enabled: false,
      regionCodes: ["MY"],
    },
    {
      key: "stripe_card",
      label: "Card (Stripe)",
      chargeCurrency: "USD",
      pricingMode: "ADD_PERCENT",
      percentBps: 350,
      feeBearer: "CUSTOMER",
      enabled: false,
    },
  ],
};

function asCurrency(value: unknown, fallback: StoreCurrency): StoreCurrency {
  return typeof value === "string" && isStoreCurrency(value) ? value : fallback;
}

export function parseRegionsCheckoutConfig(raw: string | null | undefined): RegionsCheckoutConfig {
  if (!raw || !String(raw).trim()) return structuredClone(DEFAULT_REGIONS_CHECKOUT_CONFIG);
  try {
    const parsed = JSON.parse(raw) as Partial<RegionsCheckoutConfig>;
    if (!parsed || typeof parsed !== "object") return structuredClone(DEFAULT_REGIONS_CHECKOUT_CONFIG);
    const regionsIn = Array.isArray(parsed.regions) ? parsed.regions : [];
    const methodsIn = Array.isArray(parsed.paymentMethods) ? parsed.paymentMethods : [];
    const regions: RegionDefinition[] = regionsIn
      .map((r, i) => {
        if (!r || typeof r !== "object") return null;
        const code = String((r as RegionDefinition).code || "").trim().toUpperCase();
        if (!code) return null;
        const displayCurrency = asCurrency((r as RegionDefinition).displayCurrency, DEFAULT_STORE_CURRENCY);
        const allowedRaw = Array.isArray((r as RegionDefinition).allowedCurrencies)
          ? (r as RegionDefinition).allowedCurrencies
          : [displayCurrency];
        const allowedCurrencies = allowedRaw.filter(isStoreCurrency);
        return {
          code,
          label: String((r as RegionDefinition).label || code).slice(0, 80),
          countryCodes: Array.isArray((r as RegionDefinition).countryCodes)
            ? (r as RegionDefinition).countryCodes.map((c) => String(c).toUpperCase().slice(0, 2)).filter(Boolean)
            : [],
          displayCurrency,
          allowedCurrencies: allowedCurrencies.length ? allowedCurrencies : [displayCurrency],
          allowUserCurrencySwitch: (r as RegionDefinition).allowUserCurrencySwitch === true,
          paymentMethodKeys: Array.isArray((r as RegionDefinition).paymentMethodKeys)
            ? (r as RegionDefinition).paymentMethodKeys.map((k) => String(k).trim()).filter(Boolean).slice(0, 40)
            : [],
          priceFallback: (["MYR", "USD", "HIDE"] as const).includes((r as RegionDefinition).priceFallback as PriceFallback)
            ? ((r as RegionDefinition).priceFallback as PriceFallback)
            : "MYR",
          sort: Number.isFinite((r as RegionDefinition).sort) ? Number((r as RegionDefinition).sort) : i * 10,
        } satisfies RegionDefinition;
      })
      .filter((x): x is RegionDefinition => x !== null)
      .sort((a, b) => a.sort - b.sort);

    const paymentMethods: PaymentMethodQuoteConfig[] = methodsIn
      .map((m) => {
        if (!m || typeof m !== "object") return null;
        const key = String((m as PaymentMethodQuoteConfig).key || "").trim();
        if (!key) return null;
        const chargeCurrency = asCurrency((m as PaymentMethodQuoteConfig).chargeCurrency, "MYR");
        const mode = (m as PaymentMethodQuoteConfig).pricingMode;
        const pricingMode: PaymentPricingMode =
          mode === "ADD_PERCENT" || mode === "ADD_FIXED" || mode === "PASS_THROUGH" ? mode : "PASS_THROUGH";
        return {
          key,
          label: String((m as PaymentMethodQuoteConfig).label || key).slice(0, 80),
          chargeCurrency,
          pricingMode,
          percentBps: Math.max(0, Math.min(50_000, Math.floor(Number((m as PaymentMethodQuoteConfig).percentBps) || 0))),
          fixedMinor: Math.max(0, Math.floor(Number((m as PaymentMethodQuoteConfig).fixedMinor) || 0)),
          feeBearer: (m as PaymentMethodQuoteConfig).feeBearer === "CUSTOMER" ? "CUSTOMER" : "MERCHANT",
          enabled: (m as PaymentMethodQuoteConfig).enabled !== false,
          regionCodes: Array.isArray((m as PaymentMethodQuoteConfig).regionCodes)
            ? (m as PaymentMethodQuoteConfig).regionCodes!.map((c) => String(c).toUpperCase())
            : undefined,
        } satisfies PaymentMethodQuoteConfig;
      })
      .filter((x): x is PaymentMethodQuoteConfig => x !== null);

    if (!regions.length) return structuredClone(DEFAULT_REGIONS_CHECKOUT_CONFIG);
    return {
      schemaVersion: 1,
      regions,
      paymentMethods: paymentMethods.length ? paymentMethods : structuredClone(DEFAULT_REGIONS_CHECKOUT_CONFIG.paymentMethods),
    };
  } catch {
    return structuredClone(DEFAULT_REGIONS_CHECKOUT_CONFIG);
  }
}

export function resolveRegion(
  config: RegionsCheckoutConfig,
  countryCode: string | null | undefined,
): RegionDefinition {
  const code = (countryCode || "").trim().toUpperCase();
  if (code) {
    const hit = config.regions.find((r) => r.code !== "REST" && r.countryCodes.includes(code));
    if (hit) return hit;
  }
  const rest = config.regions.find((r) => r.code === "REST") ?? config.regions[config.regions.length - 1]!;
  return rest;
}

export function resolveCurrencyForRegion(input: {
  region: RegionDefinition;
  cookieCurrency?: string | null;
}): StoreCurrency {
  const { region, cookieCurrency } = input;
  if (region.allowUserCurrencySwitch && cookieCurrency && isStoreCurrency(cookieCurrency)) {
    if (region.allowedCurrencies.includes(cookieCurrency)) return cookieCurrency;
  }
  if (region.allowedCurrencies.includes(region.displayCurrency)) return region.displayCurrency;
  return region.allowedCurrencies[0] ?? DEFAULT_STORE_CURRENCY;
}

export type PaymentQuoteResult = {
  methodKey: string;
  label: string;
  listAmountMinor: number;
  listCurrency: StoreCurrency;
  chargeAmountMinor: number;
  chargeCurrency: StoreCurrency;
  feeMinor: number;
  feeBearer: "CUSTOMER" | "MERCHANT";
  pricingMode: PaymentPricingMode;
};

export function quotePaymentMethod(
  method: PaymentMethodQuoteConfig,
  listAmountMinor: number,
  listCurrency: StoreCurrency,
): PaymentQuoteResult {
  const base = Math.max(0, Math.floor(listAmountMinor));
  let fee = 0;
  let charge = base;
  if (method.pricingMode === "ADD_PERCENT" && method.percentBps) {
    fee = Math.ceil((base * method.percentBps) / 10_000);
    if (method.feeBearer === "CUSTOMER") charge = base + fee;
  } else if (method.pricingMode === "ADD_FIXED" && method.fixedMinor) {
    fee = method.fixedMinor;
    if (method.feeBearer === "CUSTOMER") charge = base + fee;
  }
  return {
    methodKey: method.key,
    label: method.label,
    listAmountMinor: base,
    listCurrency,
    chargeAmountMinor: charge,
    chargeCurrency: method.chargeCurrency,
    feeMinor: fee,
    feeBearer: method.feeBearer,
    pricingMode: method.pricingMode,
  };
}

export function listPaymentQuotesForRegion(input: {
  config: RegionsCheckoutConfig;
  region: RegionDefinition;
  listAmountMinor: number;
  listCurrency: StoreCurrency;
}): PaymentQuoteResult[] {
  const keys = new Set(input.region.paymentMethodKeys);
  return input.config.paymentMethods
    .filter((m) => m.enabled && keys.has(m.key))
    .filter((m) => !m.regionCodes?.length || m.regionCodes.includes(input.region.code))
    .filter((m) => m.chargeCurrency === input.listCurrency || m.chargeCurrency === input.region.displayCurrency)
    .map((m) => quotePaymentMethod(m, input.listAmountMinor, input.listCurrency));
}

export function assertValidRegionsConfig(config: RegionsCheckoutConfig): void {
  for (const r of config.regions) {
    if (!STORE_CURRENCIES.includes(r.displayCurrency)) throw new Error("REGION_CURRENCY_INVALID");
  }
}
