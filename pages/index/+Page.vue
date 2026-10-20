<template>
  <main class="flex min-h-screen flex-col bg-background text-foreground">
    <!-- Header -->
    <header class="fixed inset-x-0 top-0 z-50 border-b bg-background">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <a href="/" class="flex min-w-0 items-center gap-2.5 font-semibold">
          <img :src="brandLogoUrl" :alt="`${site.name} Logo`" class="size-8 shrink-0 rounded object-contain sm:size-9" />
          <span class="truncate text-base">{{ site.name }}</span>
        </a>
        <div class="flex shrink-0 items-center gap-2">
          <PublicNav />
        </div>
      </div>
    </header>

    <!-- Notice bar -->
    <div v-if="site.notice" class="border-b bg-muted pt-14 sm:pt-16">
      <div class="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-2 text-xs text-muted-foreground sm:px-6 sm:text-sm">
        <InfoIcon class="size-4 shrink-0 text-foreground" />
        <div class="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
          <p v-if="!shouldMarqueeNotice" class="m-0 truncate" :title="site.notice">{{ site.notice }}</p>
          <template v-else>
            <p class="sr-only">{{ site.notice }}</p>
            <div aria-hidden="true" class="notice-marquee-track inline-flex w-max animate-notice-marquee">
              <span class="shrink-0 pr-12">{{ site.notice }}</span>
              <span class="shrink-0 pr-12">{{ site.notice }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Hero / search -->
    <section :class="site.notice ? '' : 'pt-14 sm:pt-16'" class="border-b bg-background">
      <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6 sm:py-8">
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-bold tracking-tight sm:text-3xl">{{ site.name }}</h1>
          <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">{{ site.subtitle || messages.storefront.fallbackSubtitle }}</p>
        </div>
        <div class="relative w-full sm:max-w-sm">
          <SearchIcon class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            type="search"
            enterkeyhint="search"
            class="h-11 rounded-md border-transparent bg-muted pl-10 shadow-none focus-visible:bg-background"
            :placeholder="messages.storefront.searchProducts"
            :aria-label="messages.storefront.searchProducts"
          />
        </div>
      </div>
    </section>

    <!-- Category bar (sticky) -->
    <nav
      v-if="data.categories.length"
      :aria-label="messages.storefront.categories"
      class="sticky top-14 z-40 border-b bg-background sm:top-16"
    >
      <div class="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          :class="chipClass(selectedCategory === null)"
          :aria-pressed="selectedCategory === null"
          @click="selectedCategory = null"
        >
          {{ messages.storefront.all }}
        </button>
        <button
          v-for="category in data.categories"
          :key="category.id"
          type="button"
          :class="chipClass(selectedCategory === category.id)"
          :aria-pressed="selectedCategory === category.id"
          @click="selectedCategory = category.id"
        >
          {{ category.name }}
        </button>
      </div>
    </nav>

    <!-- Products -->
    <section class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <div class="flex items-baseline justify-between gap-3">
        <h2 class="text-lg font-semibold tracking-tight sm:text-xl">{{ messages.storefront.products }}</h2>
        <p v-if="query" class="truncate text-xs text-muted-foreground sm:text-sm">
          {{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}
        </p>
      </div>

      <div v-if="visibleProducts.length" class="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        <article
          v-for="product in visibleProducts"
          :key="product.id"
          class="group flex flex-col overflow-hidden rounded-md border bg-card transition-colors hover:border-foreground/40"
        >
          <a :href="`/product/${product.slug}`" class="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <div class="relative aspect-square overflow-hidden bg-muted">
              <img
                :src="product.coverImage || defaultProductImage"
                :alt="product.name"
                loading="lazy"
                :class="product.availableStock === 0 ? 'opacity-50 grayscale' : ''"
                class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <Badge variant="secondary" class="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded bg-background px-1.5 py-0.5 text-[11px] font-medium shadow-none">
                {{ product.categoryName || messages.storefront.products }}
              </Badge>
            </div>
            <div class="flex flex-1 flex-col gap-1 p-3">
              <h3 class="line-clamp-2 text-sm font-medium leading-snug">{{ product.name }}</h3>
              <p v-if="product.subtitle" class="line-clamp-1 text-xs text-muted-foreground">{{ product.subtitle }}</p>
              <div class="mt-auto flex flex-col gap-0.5 pt-3">
                <span class="text-lg font-bold tabular-nums leading-none">RM {{ product.price }}</span>
                <span :class="stockClass(product)" class="text-xs">{{ stockLabel(product) }}</span>
              </div>
            </div>
          </a>
        </article>
      </div>

      <div v-else class="mt-6 rounded-md border border-dashed bg-muted/40 px-6 py-16 text-center">
        <PackageOpenIcon class="mx-auto size-8 text-muted-foreground" />
        <h3 class="mt-4 text-base font-semibold">{{ messages.storefront.noProducts }}</h3>
        <p class="mt-2 text-sm text-muted-foreground">{{ messages.storefront.noProductsDescription }}</p>
      </div>
    </section>

    <StorefrontFooter />
  </main>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { InfoIcon, PackageOpenIcon, SearchIcon } from "@lucide/vue";
import logoUrl from "@/assets/logo.svg?url";
import defaultProductImage from "@/assets/product_img.jpg?url";
import { useData } from "vike-vue/useData";
import { usePageContext } from "vike-vue/usePageContext";
import PublicNav from "@/components/storefront/PublicNav.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Data } from "./+data.server";
import { useStorefrontPreferences } from "@/lib/storefront-preferences";

type Product = Data["products"][number];
type Site = {
  name: string;
  subtitle: string | null;
  logo: string | null;
  notice: string | null;

  footerText: string | null;
};

const data = useData<Data>();
const pageContext = usePageContext() as unknown as { site: Site };
const site = pageContext.site;
const { messages, t } = useStorefrontPreferences();
const selectedCategory = ref<number | null>(null);
const query = ref("");
const shouldMarqueeNotice = computed(() => (site.notice?.length ?? 0) > 30);
const brandLogoUrl = computed(() => site.logo || logoUrl);
const visibleProducts = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return data.products.filter((product) =>
    (selectedCategory.value === null || product.categoryId === selectedCategory.value)
    && (!keyword || product.name.toLowerCase().includes(keyword) || product.subtitle?.toLowerCase().includes(keyword)),
  );
});

function chipClass(active: boolean) {
  return [
    "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
    active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
  ];
}
function stockLabel(product: Product) {
  if (product.availableStock === null) return messages.value.storefront.stockAvailable;
  return product.availableStock > 0
    ? t(messages.value.storefront.stockCount, { count: product.availableStock })
    : messages.value.storefront.outOfStock;
}
function stockClass(product: Product) {
  return product.availableStock === 0 ? "text-orange-500" : "text-muted-foreground";
}
</script>

<style scoped>
@keyframes notice-marquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}

.animate-notice-marquee {
  animation: notice-marquee 18s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-notice-marquee {
    animation: none;
  }
}
</style>
