import { normalizeSiteTimezone } from "@/lib/site-timezone";

const URL_PROTOCOLS = new Set(["http:", "https:"]);

/** Integer >= 0; invalid values fall back to default. Cap at 100 million sen (RM 1M) for money fields. */
function clampLimit(value: unknown, fallback: number, max = 100_000_000) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new Error(`${field}_TOO_LONG`);
  return normalized;
}

function optionalUrl(value: unknown, field: string) {
  const normalized = optionalText(value, field, 2_048);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (!URL_PROTOCOLS.has(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${field}_INVALID`);
  }
}

export type SiteSettingsInput = {
  siteName: string;
  siteUrl?: string | null;
  siteSubtitle?: string | null;
  logo?: string | null;
  logoIcon?: string | null;
  notice?: string | null;
  supportContact?: string | null;
  footerText?: string | null;
  orderNotice?: string | null;
  headCode?: string | null;
  footerCode?: string | null;
  registrationEnabled?: boolean;
  checkoutEnabled?: boolean;
  autoFulfillEnabled?: boolean;
  maxOrderAmountCents?: number;
  maxDailyUserAmountCents?: number;
  maxDailyUserOrders?: number;
  newAccountWindowHours?: number;
  newAccountMaxOrderCents?: number;
  newAccountMaxOrders?: number;
  ipMultiAccountMaxUsers?: number;
  ipMultiAccountWindowMinutes?: number;
  orderCreateIpLimit?: number;
  orderCreateUserLimit?: number;
  orderCreateDeviceLimit?: number;
  orderCreateWindowMinutes?: number;
  alertPaidOrderBurst?: number;
  alertSupplierFailBurst?: number;
  supplierMaxAttempts?: number;
  stepUpMinutes?: number;
  deviceMultiUserMaxUsers?: number;
  deviceMultiUserWindowMinutes?: number;
  reviewOrderAmountCents?: number;
  maxHourlyUserOrders?: number;
  behaviorWindowHours?: number;
  maxDevicesPerUser?: number;
  maxIpsPerUser?: number;
  behaviorScoreReview?: number;
  behaviorScoreBlock?: number;
  timezone: string;
};

export function validateSiteSettingsInput(input: SiteSettingsInput) {
  const siteName = String(input.siteName ?? "").trim();
  if (!siteName) throw new Error("SITE_NAME_REQUIRED");
  if (siteName.length > 120) throw new Error("SITE_NAME_TOO_LONG");

  let timezone: string;
  try {
    timezone = normalizeSiteTimezone(String(input.timezone ?? ""));
  } catch {
    throw new Error("SITE_TIMEZONE_INVALID");
  }

  return {
    siteName,
    siteUrl: optionalUrl(input.siteUrl, "SITE_URL"),
    siteSubtitle: optionalText(input.siteSubtitle, "SITE_SUBTITLE", 300),
    logo: optionalUrl(input.logo, "SITE_LOGO_URL"),
    logoIcon: optionalUrl(input.logoIcon, "SITE_FAVICON_URL"),
    notice: optionalText(input.notice, "SITE_NOTICE", 2_000),
    supportContact: optionalText(input.supportContact, "SITE_SUPPORT_CONTACT", 2_000),
    footerText: optionalText(input.footerText, "SITE_FOOTER_TEXT", 1_000),
    orderNotice: optionalText(input.orderNotice, "SITE_ORDER_NOTICE", 2_000),
    headCode: optionalText(input.headCode, "SITE_HEAD_CODE", 20_000),
    footerCode: optionalText(input.footerCode, "SITE_FOOTER_CODE", 20_000),
    registrationEnabled: input.registrationEnabled === true,
    checkoutEnabled: input.checkoutEnabled !== false,
    autoFulfillEnabled: input.autoFulfillEnabled !== false,
    maxOrderAmountCents: clampLimit(input.maxOrderAmountCents, 50_000),
    maxDailyUserAmountCents: clampLimit(input.maxDailyUserAmountCents, 200_000),
    maxDailyUserOrders: clampLimit(input.maxDailyUserOrders, 50, 10_000),
    newAccountWindowHours: clampLimit(input.newAccountWindowHours, 24, 720),
    newAccountMaxOrderCents: clampLimit(input.newAccountMaxOrderCents, 10_000),
    newAccountMaxOrders: clampLimit(input.newAccountMaxOrders, 3, 1_000),
    ipMultiAccountMaxUsers: clampLimit(input.ipMultiAccountMaxUsers, 3, 1_000),
    ipMultiAccountWindowMinutes: clampLimit(input.ipMultiAccountWindowMinutes, 60, 10_080),
    orderCreateIpLimit: clampLimit(input.orderCreateIpLimit, 12, 10_000),
    orderCreateUserLimit: clampLimit(input.orderCreateUserLimit, 6, 10_000),
    orderCreateDeviceLimit: clampLimit(input.orderCreateDeviceLimit, 8, 10_000),
    orderCreateWindowMinutes: clampLimit(input.orderCreateWindowMinutes, 15, 1_440),
    alertPaidOrderBurst: clampLimit(input.alertPaidOrderBurst, 20, 10_000),
    alertSupplierFailBurst: clampLimit(input.alertSupplierFailBurst, 5, 10_000),
    supplierMaxAttempts: clampLimit(input.supplierMaxAttempts, 5, 50),
    stepUpMinutes: clampLimit(input.stepUpMinutes, 10, 120),
    deviceMultiUserMaxUsers: clampLimit(input.deviceMultiUserMaxUsers, 3, 1_000),
    deviceMultiUserWindowMinutes: clampLimit(input.deviceMultiUserWindowMinutes, 1440, 10_080),
    reviewOrderAmountCents: clampLimit(input.reviewOrderAmountCents, 30_000),
    maxHourlyUserOrders: clampLimit(input.maxHourlyUserOrders, 10, 10_000),
    behaviorWindowHours: clampLimit(input.behaviorWindowHours, 24, 720),
    maxDevicesPerUser: clampLimit(input.maxDevicesPerUser, 3, 100),
    maxIpsPerUser: clampLimit(input.maxIpsPerUser, 5, 100),
    behaviorScoreReview: clampLimit(input.behaviorScoreReview, 50, 200),
    behaviorScoreBlock: clampLimit(input.behaviorScoreBlock, 80, 200),
    timezone,
  };
}
