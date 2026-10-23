import { eq } from "drizzle-orm";
import { siteSetting } from "@/database/drizzle/schema";
import { createDrizzleDb } from "@/database/drizzle";

export type PublicSiteSettings = {
  name: string;
  subtitle: string | null;
  siteUrl: string | null;
  logo: string | null;
  logoIcon: string | null;
  notice: string | null;
  supportContact: string | null;
  footerText: string | null;
  orderNotice: string | null;
};

type SiteSettingRecord = typeof siteSetting.$inferSelect;

type CacheEntry = {
  value: SiteSettingRecord;
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000;
let settingsCache: CacheEntry | null = null;

export const DEFAULT_FOOTER_TEXT = "© 2026 CFFK 基于 GitHub 开源";
export const DEFAULT_SUPPORT_CONTACT = "TG互助群|https://t.me/edgeKeyGroup";

const defaultSettings: SiteSettingRecord = {
  id: 1,
  siteName: "CFFK-Shop",
  siteUrl: null,
  siteSubtitle: null,
  logo: null,
  logoIcon: null,
  notice: null,
  supportContact: null,
  footerText: null,
  orderNotice: null,
  headCode: null,
  footerCode: null,
  registrationEnabled: false,
  checkoutEnabled: true,
  autoFulfillEnabled: true,
  maxOrderAmountCents: 50000,
  maxDailyUserAmountCents: 200000,
  maxDailyUserOrders: 50,
  newAccountWindowHours: 24,
  newAccountMaxOrderCents: 10000,
  newAccountMaxOrders: 3,
  ipMultiAccountMaxUsers: 6,
  ipMultiAccountWindowMinutes: 60,
  orderCreateIpLimit: 12,
  orderCreateUserLimit: 6,
  orderCreateDeviceLimit: 8,
  orderCreateWindowMinutes: 15,
  alertPaidOrderBurst: 20,
  alertSupplierFailBurst: 5,
  supplierMaxAttempts: 5,
  stepUpMinutes: 10,
  deviceMultiUserMaxUsers: 3,
  deviceMultiUserWindowMinutes: 1440,
  reviewOrderAmountCents: 30000,
  maxHourlyUserOrders: 10,
  behaviorWindowHours: 24,
  maxDevicesPerUser: 3,
  maxIpsPerUser: 5,
  behaviorScoreReview: 50,
  behaviorScoreBlock: 80,
  timezone: "Asia/Shanghai",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

async function querySettings(database: D1Database) {
  const db = createDrizzleDb(database);
  const [record] = await db.select().from(siteSetting).where(eq(siteSetting.id, 1)).limit(1);
  return record ?? defaultSettings;
}

export async function getSiteSettings(database: D1Database) {
  if (settingsCache && settingsCache.expiresAt > Date.now()) return settingsCache.value;

  const value = await querySettings(database);
  settingsCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export function invalidateSiteSettings(_database?: D1Database) {
  settingsCache = null;
}

export function toPublicSiteSettings(record: SiteSettingRecord): PublicSiteSettings {
  return {
    name: record.siteName,
    subtitle: record.siteSubtitle,
    siteUrl: record.siteUrl,
    logo: record.logo,
    logoIcon: record.logoIcon || record.logo,
    notice: record.notice,
    supportContact: record.supportContact?.trim() || DEFAULT_SUPPORT_CONTACT,
    footerText: record.footerText?.trim() || DEFAULT_FOOTER_TEXT,
    orderNotice: record.orderNotice,
  };
}
