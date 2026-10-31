<template>
  <main class="flex min-h-screen flex-col bg-[#f5f7fb] text-foreground dark:bg-background">
    <header class="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-white dark:border-border dark:bg-background">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <StorefrontBrand />
        <PublicNav />
      </div>
    </header>
    <div class="mx-auto mt-14 w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <p class="text-sm text-muted-foreground">Product page is being restored. Please redeploy after the full page is restored from git history (commit 9b1d340).</p>
      <h1 class="mt-4 text-2xl font-bold">{{ data.name }}</h1>
      <p v-if="data.subtitle" class="mt-2 text-muted-foreground">{{ data.subtitle }}</p>
      <p class="mt-4 text-2xl font-bold tabular-nums text-brand">RM{{ data.price }}</p>
      <div v-if="data.description" class="product-rich-content mt-6" v-html="data.description" />
    </div>
    <StorefrontFooter />
  </main>
</template>

<script lang="ts" setup>
import { useData } from "vike-vue/useData";
import PublicNav from "@/components/storefront/PublicNav.vue";
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";
import type { Data } from "./+data.server";
const data = useData<Data>();
</script>
