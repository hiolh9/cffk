import { computed, onMounted, ref, type ComputedRef } from "vue";

import {
  CURRENCY_COOKIE,
  CURRENCY_STORAGE_KEY,
  CURRENCY_META,
  DEFAULT_STORE_CURRENCY,
  STORE_CURRENCIES,
  currencyFromCountry,
  isStoreCurrency,
  type StoreCurrency,
} from "@/lib/currency";
import { LOCALE_COOKIE, withLocalePrefix } from "@/lib/i18n/locale-path";
import enUS from "@/lib/i18n/en-US";
import zhCN from "@/lib/i18n/zh-CN";
import zhTW from "@/lib/i18n/zh-TW";

const locales = {
  "zh-CN": zhCN,
  "en-US": enUS,
  "zh-TW": zhTW,
} as const;

export type StorefrontLocale = keyof typeof locales;
export type StorefrontTheme = "light" | "dark";
type Messages = (typeof locales)[StorefrontLocale];

const localeStorageKey = "storefront-locale";
const themeStorageKey = "storefront-theme";
/** Default storefront language: English */
const locale = ref<StorefrontLocale>("en-US");
const theme = ref<StorefrontTheme>("light");
const currency = ref<StoreCurrency>(DEFAULT_STORE_CURRENCY);
let initialized = false;

function isLocale(value: string | null): value is StorefrontLocale {
  return value === "zh-CN" || value === "zh-TW" || value === "en-US";
}

function isTheme(value: string | null): value is StorefrontTheme {
  return value === "light" || value === "dark";
}

export function detectBrowserLocale(browserLocales: readonly string[]): StorefrontLocale {
  for (const browserLocale of browserLocales) {
    const normalizedLocale = browserLocale.toLowerCase();
    if (normalizedLocale === "zh-tw" || normalizedLocale.startsWith("zh-hant") || normalizedLocale.startsWith("zh-hk") || normalizedLocale.startsWith("zh-mo")) return "zh-TW";
    if (normalizedLocale.startsWith("en")) return "en-US";
    if (normalizedLocale.startsWith("zh")) return "zh-CN";
  }
  return "en-US";
}

function writeLocaleCookie(next: StorefrontLocale) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function writeCurrencyCookie(next: StoreCurrency) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${CURRENCY_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

function applyDocumentPreferences() {
  document.documentElement.classList.toggle("dark", theme.value === "dark");
  document.documentElement.lang = locale.value === "en-US" ? "en" : locale.value === "zh-TW" ? "zh-Hant" : "zh-Hans";
  document.documentElement.dataset.currency = currency.value;
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const path = window.location.pathname || "/";
  const onEnglishPath = path === "/en" || path.startsWith("/en/");

  const savedLocale = window.localStorage.getItem(localeStorageKey);
  const cookieLocale = readCookie(LOCALE_COOKIE);
  const savedTheme = window.localStorage.getItem(themeStorageKey);
  const savedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);

  if (onEnglishPath) {
    locale.value = "en-US";
  } else if (isLocale(cookieLocale)) {
    locale.value = cookieLocale;
  } else if (isLocale(savedLocale)) {
    locale.value = savedLocale;
  } else {
    locale.value = detectBrowserLocale(navigator.languages.length > 0 ? navigator.languages : [navigator.language]);
  }
  window.localStorage.setItem(localeStorageKey, locale.value);
  writeLocaleCookie(locale.value);

  if (isTheme(savedTheme)) theme.value = savedTheme;

  if (isStoreCurrency(savedCurrency)) {
    currency.value = savedCurrency;
  } else {
    const cfCountry = document.documentElement.dataset.cfCountry || "";
    currency.value = currencyFromCountry(cfCountry);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency.value);
  }
  writeCurrencyCookie(currency.value);
  applyDocumentPreferences();
}

function replaceParams(value: string, params: Record<string, string | number>) {
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
}

export function useStorefrontPreferences(): {
  locale: typeof locale;
  theme: typeof theme;
  currency: typeof currency;
  currencyMeta: ComputedRef<(typeof CURRENCY_META)[StoreCurrency]>;
  currencies: typeof STORE_CURRENCIES;
  messages: ComputedRef<Messages>;
  setLocale: (nextLocale: StorefrontLocale) => void;
  setTheme: (nextTheme: StorefrontTheme) => void;
  setCurrency: (next: StoreCurrency) => void;
  t: (value: string, params?: Record<string, string | number>) => string;
} {
  onMounted(initialize);

  const messages = computed(() => locales[locale.value]);
  const currencyMeta = computed(() => CURRENCY_META[currency.value]);

  function setLocale(nextLocale: StorefrontLocale) {
    const prev = locale.value;
    locale.value = nextLocale;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(localeStorageKey, nextLocale);
    writeLocaleCookie(nextLocale);
    applyDocumentPreferences();

    // English uses /en prefix for SEO; other locales use unprefixed paths
    const target = withLocalePrefix(window.location.pathname + window.location.search, nextLocale);
    const current = window.location.pathname + window.location.search;
    if (target !== current || prev !== nextLocale) {
      window.location.assign(target);
    }
  }

  function setTheme(nextTheme: StorefrontTheme) {
    theme.value = nextTheme;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(themeStorageKey, nextTheme);
    applyDocumentPreferences();
  }

  function setCurrency(next: StoreCurrency) {
    if (currency.value === next) return;
    currency.value = next;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    writeCurrencyCookie(next);
    applyDocumentPreferences();
    window.location.reload();
  }

  function t(value: string, params: Record<string, string | number> = {}) {
    return replaceParams(value, params);
  }

  return {
    locale,
    theme,
    currency,
    currencyMeta,
    currencies: STORE_CURRENCIES,
    messages,
    setLocale,
    setTheme,
    setCurrency,
    t,
  };
}
