/** URL locale prefix helpers. English uses /en; default (no prefix) is still valid for any locale via cookie. */

export type UrlLocale = "en" | null;

export function stripLocalePrefix(pathname: string): { locale: UrlLocale; path: string } {
  const raw = pathname || "/";
  if (raw === "/en" || raw === "/en/") return { locale: "en", path: "/" };
  if (raw.startsWith("/en/")) return { locale: "en", path: raw.slice(3) || "/" };
  return { locale: null, path: raw.startsWith("/") ? raw : `/${raw}` };
}

/** Build a path for the chosen locale (en → /en/...; others → unprefixed). */
export function withLocalePrefix(pathname: string, localeCode: "en-US" | "zh-CN" | "zh-TW"): string {
  const { path } = stripLocalePrefix(pathname);
  if (localeCode === "en-US") {
    if (path === "/") return "/en";
    return `/en${path.startsWith("/") ? path : `/${path}`}`;
  }
  return path;
}

export const LOCALE_COOKIE = "storefront-locale";
