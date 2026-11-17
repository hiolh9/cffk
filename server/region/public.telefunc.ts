import { eq } from "drizzle-orm";
import { siteSetting } from "@/database/drizzle/schema";
import type { StoreCurrency } from "@/lib/currency";
import { listPaymentQuotesForRegion } from "@/lib/region/config";
import { resolveCheckoutContext } from "@/server/currency/resolve";
import { telefuncAction } from "@/server/telefunc-action";
import { requireDatabase } from "@/server/telefunc-context";

async function internalOnGetCheckoutRegionContext(input?: {
  listAmountMinor?: number;
  listCurrency?: string;
  country?: string | null;
}) {
  const { db } = requireDatabase();
  const [row] = await db
    .select({ regionsConfigJson: siteSetting.regionsConfigJson })
    .from(siteSetting)
    .where(eq(siteSetting.id, 1))
    .limit(1);

  const { config, region, currency } = resolveCheckoutContext({
    cookieHeader: null,
    cfCountry: input?.country ?? null,
    regionsConfigJson: row?.regionsConfigJson ?? null,
  });

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
    allowedCurrencies: region.allowedCurrencies,
    paymentMethodKeys: region.paymentMethodKeys,
    quotes,
  };
}

export const onGetCheckoutRegionContext = telefuncAction(internalOnGetCheckoutRegionContext);
