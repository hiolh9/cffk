<template>
  <main class="flex min-h-screen flex-col bg-background text-foreground">
    <header class="border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <StorefrontBrand />
        <PublicNav />
      </div>
    </header>

    <article class="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <nav class="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <ol class="flex flex-wrap items-center gap-1.5">
          <li><a href="/" class="hover:text-foreground">Home</a></li>
          <li aria-hidden="true">/</li>
          <li><a href="/blog" class="hover:text-foreground">Blog</a></li>
          <li aria-hidden="true">/</li>
          <li class="text-foreground line-clamp-1">{{ post.title }}</li>
        </ol>
      </nav>

      <!-- Single H1 for SEO -->
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{{ post.title }}</h1>
      <p class="mt-3 text-sm text-muted-foreground">
        <time v-if="post.publishedAt" :datetime="toIso(post.publishedAt)">{{ formatDate(post.publishedAt) }}</time>
        <span v-if="post.authorName"> · {{ post.authorName }}</span>
      </p>
      <p v-if="post.excerpt" class="mt-4 text-base text-muted-foreground">{{ post.excerpt }}</p>

      <img
        v-if="post.coverImage"
        :src="post.coverImage"
        :alt="post.title"
        class="mt-8 w-full rounded-2xl border object-cover"
        loading="eager"
      />

      <!-- Body: use semantic HTML from editor (h2/h3/p/ul/li). Do not inject another h1. -->
      <div class="blog-prose mt-8 max-w-none" v-html="post.contentHtml" />

      <section v-if="faqs.length" class="mt-12 border-t pt-8">
        <h2 class="text-xl font-semibold">FAQ</h2>
        <div class="mt-4 space-y-4">
          <div v-for="(item, index) in faqs" :key="index" class="rounded-xl border p-4">
            <h3 class="font-medium">{{ item.question }}</h3>
            <p class="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{{ item.answer }}</p>
          </div>
        </div>
      </section>
    </article>

    <StorefrontFooter />

    <script v-if="jsonLd" type="application/ld+json" v-text="jsonLd" />
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vike-vue/useData";
import { usePageContext } from "vike-vue/usePageContext";
import PublicNav from "@/components/storefront/PublicNav.vue";
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";
import { buildBlogJsonLd, parseFaqJson, stringifyJsonLd } from "@/lib/blog/seo";
import type { Data } from "./+data.server";

const data = useData<Data>();
const post = computed(() => data.value.post);
const pageContext = usePageContext() as {
  site?: { name?: string; siteUrl?: string | null };
  urlPathname?: string;
  urlParsed?: { origin?: string };
};

const faqs = computed(() => parseFaqJson(post.value.faqJson));

const jsonLd = computed(() => {
  const origin =
    normalizeOrigin(pageContext.site?.siteUrl)
    || normalizeOrigin(pageContext.urlParsed?.origin)
    || "";
  if (!origin) return null;
  const pageUrl = new URL(pageContext.urlPathname || `/blog/${post.value.slug}`, `${origin}/`).toString();
  const nodes = buildBlogJsonLd({
    title: post.value.title,
    slug: post.value.slug,
    excerpt: post.value.excerpt,
    contentHtml: post.value.contentHtml,
    coverImage: post.value.coverImage,
    seoTitle: post.value.seoTitle,
    seoDescription: post.value.seoDescription,
    schemaType: post.value.schemaType,
    faqJson: post.value.faqJson,
    customSchemaJson: post.value.customSchemaJson,
    authorName: post.value.authorName,
    publishedAt: post.value.publishedAt,
    updatedAt: post.value.updatedAt,
    siteName: pageContext.site?.name || "Sparkpay",
    siteUrl: origin,
    pageUrl,
  });
  return stringifyJsonLd(nodes);
});

function toIso(value: Date | string | number) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function formatDate(value: Date | string | number) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-MY", { year: "numeric", month: "short", day: "numeric" });
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
</script>

<style scoped>
.blog-prose :deep(h2) {
  margin-top: 1.75rem;
  margin-bottom: 0.75rem;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.3;
}
.blog-prose :deep(h3) {
  margin-top: 1.35rem;
  margin-bottom: 0.5rem;
  font-size: 1.15rem;
  font-weight: 600;
}
.blog-prose :deep(p) {
  margin: 0.85rem 0;
  line-height: 1.75;
}
.blog-prose :deep(ul),
.blog-prose :deep(ol) {
  margin: 0.85rem 0;
  padding-left: 1.25rem;
}
.blog-prose :deep(li) {
  margin: 0.35rem 0;
  line-height: 1.6;
}
.blog-prose :deep(a) {
  color: var(--color-brand, #0088ee);
  text-decoration: underline;
}
.blog-prose :deep(img) {
  max-width: 100%;
  border-radius: 0.75rem;
  margin: 1rem 0;
}
</style>
