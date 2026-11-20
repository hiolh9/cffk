import { eq } from "drizzle-orm";
import { siteSetting } from "@/database/drizzle/schema";
import type { StoreCurrency } from "@/lib/currency";
import { listPaymentQuotesForRegion, listStorefrontCurrencies, parseRegionsCheckoutConfig } from "@/lib/region/config";
import { resolveCheckoutContext } from "@/server/currency/resolve";
import { telefuncAction } from "@/server/telefunc-action";
import { requireDatabase } from "@/server/telefunc-context";

async function loadRegionsJson() {
  const { db } = requireDatabase();
  try {
    const [row] = await db
      .select({ regionsConfigJson: siteSetting.regionsConfigJson })
      .from(siteSetting)
      .where(eq(siteSetting.id, 1))
      .limit(1);
    return row?.regionsConfigJson ?? null;
  } catch {
    return null;
  }
}

async function internalOnGetCheckoutRegionContext(input?: {
  listAmountMinor?: number;
  listCurrency?: string;
  country?: string | null;
}) {
  const regionsConfigJson = await loadRegionsJson();
  const { config, region, currency } = resolveCheckoutContext({
    cookieHeader: null,
    cfCountry: input?.country ?? null,
    regionsConfigJson,
  });
  const { enabledCurrencies, allowedInRegion } = listStorefrontCurrencies(config, input?.country);

  const listAmountMinor = Math.max(0, Math.floor(Number(input?.listAmountMinor) || 0));
  const listCurrency = (input?.listCurrency || currency) as StoreCurrency;
  const quotes =
    listAmountMinor > 0
      ? listPaymentQuotesForRegion({
          config,
          region,
          listAmountMinor,
          listCurrency,
        })
      : [];

  return {
    regionCode: region.code,
    regionLabel: region.label,
    currency,
    allowUserCurrencySwitch: region.allowUserCurrencySwitch,
    allowedCurrencies: allowedInRegion,
    enabledCurrencies,
    paymentMethodKeys: region.paymentMethodKeys,
    quotes,
  };
}

async function internalOnGetStorefrontCurrencies(input?: { country?: string | null }) {
  const regionsConfigJson = await loadRegionsJson();
  const config = parseRegionsCheckoutConfig(regionsConfigJson);
  const { enabledCurrencies, region, allowedInRegion } = listStorefrontCurrencies(config, input?.country);
  return {
    enabledCurrencies,
    regionCode: region.code,
    displayCurrency: region.displayCurrency,
    allowUserCurrencySwitch: region.allowUserCurrencySwitch,
    allowedCurrencies: allowedInRegion,
  };
}

export const onGetCheckoutRegionContext = telefuncAction(internalOnGetCheckoutRegionContext);
export const onGetStorefrontCurrencies = telefuncAction(internalOnGetStorefrontCurrencies);
