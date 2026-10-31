<template>
  <main class="flex min-h-screen flex-col bg-[#f5f7fb] text-foreground dark:bg-background">
    <!-- Top bar: solid white like marketplace sites -->
    <header class="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-white dark:border-border dark:bg-background">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-14 sm:gap-3 sm:px-5">
        <StorefrontBrand />
        <div class="flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1">
          <PublicNav />
        </div>
      </div>
    </header>

    <!-- Notice strip -->
    <div v-if="site.notice" class="border-b border-brand/10 bg-brand-soft pt-14">
      <div class="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 text-xs text-foreground/80 sm:px-5 sm:text-sm">
        <InfoIcon class="size-3.5 shrink-0 text-brand sm:size-4" />
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

    <!-- Compact search band (SEAGM-style: tools first, not a big marketing hero) -->
    <section :class="site.notice ? '' : 'pt-14'" class="border-b border-black/5 bg-white dark:border-border dark:bg-background">
      <div class="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div class="min-w-0">
            <h1 class="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">{{ site.name }}</h1>
            <p class="mt-0.5 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
              {{ site.subtitle || messages.storefront.fallbackSubtitle }}
            </p>
          </div>
          <div class="relative w-full sm:max-w-md">
            <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="query"
              type="search"
              enterkeyhint="search"
              class="h-10 rounded-lg border-black/8 bg-[#f5f7fb] pl-9 text-sm shadow-none focus-visible:border-brand focus-visible:ring-brand/30 dark:bg-muted"
              :placeholder="messages.storefront.searchProducts"
              :aria-label="messages.storefront.searchProducts"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Category tabs: underline style -->
    <nav
      v-if="data.categories.length"
      :aria-label="messages.storefront.categories"
      class="sticky top-14 z-40 border-b border-black/5 bg-white/95 backdrop-blur-md dark:border-border dark:bg-background/95"
    >
      <div class="mx-auto flex max-w-6xl gap-0 overflow-x-auto px-1 sm:px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

    <!-- Product grid -->
    <section class="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-5 sm:py-6">
      <div class="mb-3 flex items-baseline justify-between gap-3 sm:mb-4">
        <h2 class="text-sm font-semibold text-foreground sm:text-base">{{ messages.storefront.products }}</h2>
        <p class="text-xs tabular-nums text-muted-foreground">
          {{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}
        </p>
      </div>

      <div
        v-if="visibleProducts.length"
        class="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        <article
          v-for="product in visibleProducts"
          :key="product.id"
          class="group overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-brand/25 hover:shadow-[0_8px_24px_rgba(0,136,238,0.12)] dark:border-border dark:bg-card"
        >
          <a
            :href="`/product/${product.slug}`"
            class="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <div class="relative aspect-[4/3] overflow-hidden bg-[#eef2f7] dark:bg-muted">
              <img
                :src="product.coverImage || defaultProductImage"
                :alt="product.name"
                loading="lazy"
                decoding="async"
                :class="product.availableStock === 0 ? 'opacity-45 grayscale' : ''"
                class="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.05]"
              />
              <span
                v-if="product.categoryName"
                class="absolute left-1.5 top-1.5 max-w-[70%] truncate rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 shadow-sm backdrop-blur dark:bg-background/90"
              >
                {{ product.categoryName }}
              </span>
              <span
                v-if="product.availableStock === 0"
                class="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-center text-[10px] font-medium text-white"
              >
                {{ messages.storefront.outOfStock }}
              </span>
            </div>
            <div class="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
              <h3 class="line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-snug text-foreground group-hover:text-brand sm:text-sm">
                {{ product.name }}
              </h3>
              <p v-if="product.subtitle" class="line-clamp-1 text-[11px] text-muted-foreground">{{ product.subtitle }}</p>
              <div class="mt-auto flex flex-col gap-0.5 pt-1.5">
                <span class="whitespace-nowrap text-[15px] font-bold tabular-nums leading-none text-[#e11d48] sm:text-base">
                  <span class="mr-0.5 text-[0.7em] font-semibold opacity-90">RM</span>{{ product.price }}
                </span>
                <span :class="stockClass(product)" class="text-[10px] leading-tight sm:text-[11px]">{{ stockLabel(product) }}</span>
              </div>
            </div>
          </a>
        </article>
      </div>

      <div v-else class="mt-4 rounded-xl border border-dashed border-black/10 bg-white px-6 py-14 text-center dark:bg-card">
        <PackageOpenIcon class="mx-auto size-7 text-muted-foreground" />
        <h3 class="mt-3 text-sm font-semibold">{{ messages.storefront.noProducts }}</h3>
        <p class="mt-1.5 text-xs text-muted-foreground sm:text-sm">{{ messages.storefront.noProductsDescription }}</p>
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
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";
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
    "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
    active
      ? "border-brand text-brand"
      : "border-transparent text-muted-foreground hover:border-black/10 hover:text-foreground",
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
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
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
