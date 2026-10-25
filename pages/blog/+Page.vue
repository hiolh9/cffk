<template>
  <main class="flex min-h-screen flex-col bg-background text-foreground">
    <header class="border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <StorefrontBrand />
        <PublicNav />
      </div>
    </header>

    <section class="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 class="text-3xl font-bold tracking-tight">Blog</h1>
      <p class="mt-2 text-muted-foreground">Guides, updates, and product tips.</p>

      <div v-if="data.posts.length" class="mt-8 flex flex-col gap-6">
        <article
          v-for="post in data.posts"
          :key="post.id"
          class="rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:border-brand/30"
        >
          <a :href="`/blog/${post.slug}`" class="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <h2 class="text-xl font-semibold tracking-tight hover:text-brand">{{ post.title }}</h2>
            <p v-if="post.excerpt" class="mt-2 line-clamp-2 text-sm text-muted-foreground">{{ post.excerpt }}</p>
            <p class="mt-3 text-xs text-muted-foreground">
              <time v-if="post.publishedAt" :datetime="toIso(post.publishedAt)">{{ formatDate(post.publishedAt) }}</time>
              <span v-if="post.authorName"> · {{ post.authorName }}</span>
            </p>
          </a>
        </article>
      </div>
      <div v-else class="mt-10 rounded-2xl border border-dashed bg-muted/40 px-6 py-16 text-center text-muted-foreground">
        No published articles yet.
      </div>
    </section>

    <StorefrontFooter />
  </main>
</template>

<script setup lang="ts">
import { useData } from "vike-vue/useData";
import PublicNav from "@/components/storefront/PublicNav.vue";
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";
import type { Data } from "./+data.server";

const data = useData<Data>();

function toIso(value: Date | string | number) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function formatDate(value: Date | string | number) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-MY", { year: "numeric", month: "short", day: "numeric" });
}
</script>
