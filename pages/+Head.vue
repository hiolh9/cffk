<template>
  <link rel="icon" :href="iconUrl" />
  <link rel="apple-touch-icon" :href="iconUrl" />
  <link v-if="seo.canonicalUrl" rel="canonical" :href="seo.canonicalUrl" />
  <link v-for="alt in hreflangAlternates" :key="alt.hreflang" rel="alternate" :hreflang="alt.hreflang" :href="alt.href" />
  <meta v-if="seo.robots" name="robots" :content="seo.robots" />
  <template v-if="!seo.robots">
    <meta property="og:type" :content="seo.ogType" />
    <meta property="og:title" :content="seo.title" />
    <meta property="og:description" :content="seo.description" />
    <meta property="og:site_name" :content="seo.siteName" />
    <meta property="og:locale" :content="seo.ogLocale" />
    <meta v-if="seo.canonicalUrl" property="og:url" :content="seo.canonicalUrl" />
    <meta v-if="seo.imageUrl" property="og:image" :content="seo.imageUrl" />
    <meta name="twitter:card" :content="seo.imageUrl ? 'summary_large_image' : 'summary'" />
    <meta name="twitter:title" :content="seo.title" />
    <meta name="twitter:description" :content="seo.description" />
    <meta v-if="seo.imageUrl" name="twitter:image" :content="seo.imageUrl" />
  </template>
  <!-- JSON-LD only in +Head (allowed); never put <script> inside page body templates -->
  <script v-if="productJsonLd" type="application/ld+json" v-text="productJsonLd" />
  <script v-if="siteJsonLd" type="application/ld+json" v-text="siteJsonLd" />
  <script v-if="blogJsonLd" type="application/ld+json" v-text="blogJsonLd" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import defaultLogoUrl from "@/assets/logo.svg?url";
import { stripLocalePrefix, withLocalePrefix } from "@/lib/i18n/locale-path";
import { buildBlogJsonLd, stringifyJsonLd as stringifyBlogJsonLd } from "@/lib/blog/seo";
import { buildProductJsonLd, buildSiteJsonLd, stringifyJsonLd } from "@/lib/seo/json-ld";

type Site = {
  name?: string;
  subtitle?: string | null;
  siteUrl?: string | null;
  logo?: string | null;
  logoIcon?: string | null;
};

type ProductSku = { price: string; currency?: string; availableStock?: number | null };

type ProductData = {
  name?: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  coverImage?: string | null;
  categoryName?: string | null;
  price?: string;
  currency?: string;
  availableStock?: number | null;
  ratingValue?: string | number | null;
  reviewCount?: number | null;
  skus?: ProductSku[];
};

type BlogPostData = {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  contentHtml?: string;
  coverImage?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  schemaType?: "BlogPosting" | "Article" | "FAQPage";
  faqJson?: string | null;
  customSchemaJson?: string | null;
  authorName?: string | null;
  publishedAt?: Date | string | number | null;
  updatedAt?: Date | string | number | null;
};

type PageData = ProductData & { post?: BlogPostData; posts?: unknown[] };

type SeoPageContext = {
  site?: Site;
  data?: PageData;
  urlPathname?: string;
  urlLocale?: "en" | null;
  routeParams?: { adminPath?: string };
  urlParsed?: { origin?: string };
};

const pageContext = usePageContext() as SeoPageContext;

const pathInfo = computed(() => {
  const stripped = stripLocalePrefix(pageContext.urlPathname || "/");
  if (!stripped.locale && pageContext.urlLocale === "en") {
    return { locale: "en" as const, path: stripped.path };
  }
  return stripped;
});

const isPrivatePage = computed(() => {
  const pathname = pathInfo.value.path;
  return (
    Boolean(pageContext.routeParams?.adminPath)
    || pathname === "/setup"
    || pathname === "/order"
    || pathname === "/checkout"
    || pathname === "/payment-result"
    || pathname === "/two-factor"
    || pathname === "/login"
    || pathname === "/signup"
    || pathname.startsWith("/account")
    || pathname.startsWith("/auth/")
    || pathname.startsWith("/_error")
  );
});

const siteUrl = computed(
  () => normalizeOrigin(pageContext.site?.siteUrl) || normalizeOrigin(pageContext.urlParsed?.origin),
);
const iconUrl = computed(() => pageContext.site?.logoIcon || pageContext.site?.logo || defaultLogoUrl);

const blogPost = computed(() => {
  const data = pageContext.data;
  const post = data?.post;
  if (post?.title && post?.slug && post?.contentHtml != null) return post;
  return null;
});

const seo = computed(() => {
  const siteName = pageContext.site?.name || "Sparkpay";
  const product = pageContext.data;
  const pathname = pathInfo.value.path;
  const isProductPage = Boolean(product?.name && pathname.startsWith("/product/"));
  const isBlogPost = Boolean(blogPost.value && pathname.startsWith("/blog/"));
  const isBlogIndex = pathname === "/blog";

  let title = siteName;
  let description = pageContext.site?.subtitle || "Digital top-up store in Malaysia. Pay in MYR.";
  let ogType = "website";
  let imageSource: string | null | undefined = pageContext.site?.logoIcon || pageContext.site?.logo || defaultLogoUrl;

  if (isProductPage && product?.name) {
    title = `${product.name} - ${siteName}`;
    description =
      product.subtitle?.trim() || toPlainText(product.description) || description;
    ogType = "product";
    imageSource = product.coverImage || imageSource;
  } else if (isBlogPost && blogPost.value) {
    const p = blogPost.value;
    title = `${p.seoTitle?.trim() || p.title} - ${siteName}`;
    description = p.seoDescription?.trim() || p.excerpt?.trim() || toPlainText(p.contentHtml) || description;
    ogType = "article";
    imageSource = p.coverImage || imageSource;
  } else if (isBlogIndex) {
    title = `Blog - ${siteName}`;
    description = "Guides, updates, and product tips.";
  }

  const isEnglish = pathInfo.value.locale === "en";
  const canonicalPath = isEnglish ? withLocalePrefix(pathname, "en-US") : pathname;
  const canonicalUrl =
    !isPrivatePage.value && siteUrl.value
      ? new URL(canonicalPath, `${siteUrl.value}/`).toString()
      : null;
  const imageUrl = !isPrivatePage.value ? toAbsoluteUrl(imageSource, siteUrl.value) : null;

  return {
    title,
    description,
    siteName,
    canonicalUrl,
    imageUrl,
    ogType,
    ogLocale: isEnglish ? "en_US" : "zh_CN",
    robots: isPrivatePage.value ? "noindex,nofollow,noarchive" : null,
  };
});

const hreflangAlternates = computed(() => {
  if (isPrivatePage.value || !siteUrl.value) return [] as Array<{ hreflang: string; href: string }>;
  const origin = siteUrl.value.replace(/\/$/, "");
  const basePath = pathInfo.value.path;
  const defaultPath = basePath === "/" ? "/" : basePath;
  const enPath = withLocalePrefix(basePath, "en-US");
  return [
    { hreflang: "x-default", href: `${origin}${defaultPath === "/" ? "/" : defaultPath}` },
    { hreflang: "en", href: `${origin}${enPath}` },
    { hreflang: "zh-Hans", href: `${origin}${defaultPath === "/" ? "/" : defaultPath}` },
  ];
});

const productJsonLd = computed(() => {
  const product = pageContext.data;
  const pathname = pathInfo.value.path;
  if (!product?.name || !product.slug || !pathname.startsWith("/product/")) return null;
  if (blogPost.value) return null;
  if (isPrivatePage.value || !siteUrl.value) return null;

  const origin = siteUrl.value.replace(/\/$/, "");
  const productPath =
    pathInfo.value.locale === "en" ? withLocalePrefix(pathname, "en-US") : pathname;
  const productUrl = new URL(productPath, `${origin}/`).toString();
  const prices = (product.skus?.map((s) => s.price).filter(Boolean) as string[]) || [];
  if (product.price) prices.push(product.price);
  const uniquePrices = [...new Set(prices)];
  const sorted = uniquePrices.slice().sort((a, b) => Number(a) - Number(b));

  const stockValues = product.skus?.map((s) => s.availableStock) ?? [product.availableStock];
  let availableStock: number | null = null;
  if (stockValues.every((s) => s === null || s === undefined)) {
    availableStock = null;
  } else {
    availableStock = stockValues.reduce<number>((sum, s) => sum + (typeof s === "number" ? s : 0), 0);
  }

  const offerCurrency = product.currency || product.skus?.[0]?.currency || "MYR";

  const nodes = buildProductJsonLd({
    name: product.name,
    slug: product.slug,
    description: product.description,
    subtitle: product.subtitle,
    coverImage: product.coverImage,
    categoryName: product.categoryName,
    price: sorted[0] || product.price || "0",
    lowPrice: sorted[0],
    highPrice: sorted[sorted.length - 1],
    availableStock,
    ratingValue: product.ratingValue,
    reviewCount: product.reviewCount,
    currency: offerCurrency,
    siteName: pageContext.site?.name || "Sparkpay",
    siteUrl: origin,
    productUrl,
  });

  return stringifyJsonLd(nodes);
});

const siteJsonLd = computed(() => {
  const pathname = pathInfo.value.path;
  if (pathname !== "/" || isPrivatePage.value || !siteUrl.value) return null;
  const origin = siteUrl.value.replace(/\/$/, "");
  const nodes = buildSiteJsonLd({
    siteName: pageContext.site?.name || "Sparkpay",
    siteUrl: origin,
    description: pageContext.site?.subtitle || "Digital top-up store in Malaysia. Pay in MYR.",
    logoUrl: pageContext.site?.logoIcon || pageContext.site?.logo || null,
  });
  return stringifyJsonLd(nodes);
});

const blogJsonLd = computed(() => {
  const post = blogPost.value;
  if (!post || isPrivatePage.value || !siteUrl.value) return null;
  const origin = siteUrl.value.replace(/\/$/, "");
  const pathname = pathInfo.value.path;
  const pagePath =
    pathInfo.value.locale === "en" ? withLocalePrefix(pathname, "en-US") : pathname;
  const pageUrl = new URL(pagePath, `${origin}/`).toString();
  const nodes = buildBlogJsonLd({
    title: post.title!,
    slug: post.slug!,
    excerpt: post.excerpt ?? null,
    contentHtml: post.contentHtml || "",
    coverImage: post.coverImage ?? null,
    seoTitle: post.seoTitle ?? null,
    seoDescription: post.seoDescription ?? null,
    schemaType: post.schemaType || "BlogPosting",
    faqJson: post.faqJson ?? null,
    customSchemaJson: post.customSchemaJson ?? null,
    authorName: post.authorName ?? null,
    publishedAt: post.publishedAt ?? null,
    updatedAt: post.updatedAt ?? null,
    siteName: pageContext.site?.name || "Sparkpay",
    siteUrl: origin,
    pageUrl,
  });
  return stringifyBlogJsonLd(nodes);
});

function toPlainText(value: string | null | undefined) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "";
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function toAbsoluteUrl(value: string | null | undefined, origin: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value, origin || undefined);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
</script>
