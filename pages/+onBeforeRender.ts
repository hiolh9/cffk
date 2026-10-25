import type { PageContextServer } from "vike/types";
import { env } from "@/server/env";
import { DEFAULT_FOOTER_TEXT, DEFAULT_SUPPORT_CONTACT, getSiteSettings, toPublicSiteSettings } from "@/server/site/public-settings";

function headerGet(pageContext: PageContextServer, name: string): string | null {
  const headers = (pageContext as { headers?: Headers | Record<string, string> }).headers;
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name);
  const key = Object.keys(headers as Record<string, string>).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? (headers as Record<string, string>)[key] ?? null : null;
}

export async function onBeforeRender(pageContext: PageContextServer) {
  const localeHeader = headerGet(pageContext, "x-storefront-locale");
  const urlLocale = localeHeader === "en-US" ? "en" : null;

  try {
    return {
      pageContext: {
        site: toPublicSiteSettings(await getSiteSettings(env.DB)),
        urlLocale,
      },
    };
  } catch {
    return {
      pageContext: {
        urlLocale,
        site: {
          name: "CFFK-Shop",
          subtitle: null,
          siteUrl: null,
          logo: null,
          logoIcon: null,
          notice: null,
          supportContact: DEFAULT_SUPPORT_CONTACT,
          footerText: DEFAULT_FOOTER_TEXT,
          orderNotice: null,
        },
      },
    };
  }
}
