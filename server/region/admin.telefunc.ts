import { eq } from "drizzle-orm";
import { siteSetting } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";
import {
  assertValidRegionsConfig,
  DEFAULT_REGIONS_CHECKOUT_CONFIG,
  parseRegionsCheckoutConfig,
  type RegionsCheckoutConfig,
} from "@/lib/region/config";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin } from "@/server/telefunc-context";

async function internalOnGetRegionsConfig() {
  const { db } = requireAdmin();
  try {
    const [row] = await db
      .select({ regionsConfigJson: siteSetting.regionsConfigJson })
      .from(siteSetting)
      .where(eq(siteSetting.id, 1))
      .limit(1);
    const config = parseRegionsCheckoutConfig(row?.regionsConfigJson ?? null);
    return { config, raw: row?.regionsConfigJson ?? null };
  } catch {
    return { config: structuredClone(DEFAULT_REGIONS_CHECKOUT_CONFIG), raw: null };
  }
}

async function internalOnSaveRegionsConfig(input: { config: RegionsCheckoutConfig }) {
  const { db } = requireAdmin();
  if (!input?.config || typeof input.config !== "object") appError("REGION_CONFIG_INVALID");
  const config = parseRegionsCheckoutConfig(JSON.stringify(input.config));
  try {
    assertValidRegionsConfig(config);
  } catch {
    appError("REGION_CONFIG_INVALID");
  }
  const raw = JSON.stringify(config);
  const now = new Date();
  const [existing] = await db.select({ id: siteSetting.id }).from(siteSetting).where(eq(siteSetting.id, 1)).limit(1);
  if (!existing) appError("SITE_SETTINGS_NOT_FOUND");
  try {
    await db
      .update(siteSetting)
      .set({ regionsConfigJson: raw, updatedAt: now })
      .where(eq(siteSetting.id, 1));
  } catch {
    appError("REGION_CONFIG_SAVE_FAILED");
  }
  return { config };
}

async function internalOnResetRegionsConfig() {
  return internalOnSaveRegionsConfig({ config: structuredClone(DEFAULT_REGIONS_CHECKOUT_CONFIG) });
}

export const onGetRegionsConfig = telefuncAction(internalOnGetRegionsConfig);
export const onSaveRegionsConfig = telefuncAction(internalOnSaveRegionsConfig);
export const onResetRegionsConfig = telefuncAction(internalOnResetRegionsConfig);
