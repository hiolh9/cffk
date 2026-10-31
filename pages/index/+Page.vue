<template>
  <main class="flex min-h-screen flex-col bg-[#f5f7fa] text-foreground dark:bg-background">
    <!-- Top bar -->
    <header class="fixed inset-x-0 top-0 z-50 border-b border-black/[0.06] bg-white/95 backdrop-blur-md dark:border-border dark:bg-background/95">
      <div class="mx-auto flex h-13 max-w-[1100px] items-center justify-between gap-2 px-3 sm:h-14 sm:gap-4 sm:px-5">
        <StorefrontBrand />
        <!-- Desktop search in header (SEAGM-style center tools) -->
        <div class="relative mx-2 hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-lg">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            type="search"
            enterkeyhint="search"
            class="h-9 rounded-full border-black/8 bg-[#f5f7fa] pl-9 text-sm shadow-none focus-visible:border-brand focus-visible:ring-brand/25 dark:bg-muted"
            :placeholder="messages.storefront.searchProducts"
            :aria-label="messages.storefront.searchProducts"
          />
        </div>
        <div class="flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1">
          <PublicNav />
        </div>
      </div>
    </header>

    <!-- Notice -->
    <div v-if="site.notice" class="border-b border-brand/15 bg-brand-soft pt-13 sm:pt-14">
      <div class="mx-auto flex max-w-[1100px] items-center gap-2 px-3 py-2 text-xs text-foreground/80 sm:px-5 sm:text-[13px]">
        <InfoIcon class="size-3.5 shrink-0 text-brand" />
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

    <!-- Mobile search + title strip -->
    <section :class="site.notice ? '' : 'pt-13 sm:pt-14'" class="border-b border-black/[0.06] bg-white dark:border-border dark:bg-background">
      <div class="mx-auto max-w-[1100px] px-3 py-3 sm:px-5 sm:py-4">
        <div class="flex flex-col gap-2.5">
          <div class="min-w-0 md:hidden">
            <h1 class="truncate text-base font-bold tracking-tight text-foreground">{{ site.name }}</h1>
            <p class="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
              {{ site.subtitle || messages.storefront.fallbackSubtitle }}
            </p>
          </div>
          <div class="relative w-full md:hidden">
            <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="query"
              type="search"
              enterkeyhint="search"
              class="h-10 rounded-full border-black/8 bg-[#f5f7fa] pl-9 text-sm shadow-none focus-visible:border-brand focus-visible:ring-brand/25 dark:bg-muted"
              :placeholder="messages.storefront.searchProducts"
              :aria-label="messages.storefront.searchProducts"
            />
          </div>
          <div class="hidden min-w-0 md:block">
            <h1 class="truncate text-lg font-bold tracking-tight text-foreground">{{ site.name }}</h1>
            <p class="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">
              {{ site.subtitle || messages.storefront.fallbackSubtitle }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Category chips: horizontal scroll (SEAGM ≤1000px pattern) -->
    <nav
      v-if="data.categories.length"
      :aria-label="messages.storefront.categories"
      class="sticky top-13 z-40 border-b border-black/[0.06] bg-white/95 backdrop-blur-md sm:top-14 dark:border-border dark:bg-background/95"
    >
      <div
        class="mx-auto flex max-w-[1100px] gap-2 overflow-x-auto px-3 py-2.5 sm:gap-2.5 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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
    <section class="mx-auto w-full max-w-[1100px] flex-1 px-3 py-4 sm:px-5 sm:py-6">
      <div class="mb-3 flex items-baseline justify-between gap-3">
        <h2 class="text-[13px] font-semibold uppercase tracking-wide text-foreground/80 sm:text-sm">
          {{ messages.storefront.products }}
        </h2>
        <p class="text-[11px] tabular-nums text-muted-foreground sm:text-xs">
          {{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}
        </p>
      </div>

      <div
        v-if="visibleProducts.length"
        class="grid grid-cols-2 gap-2.5 xs:gap-3 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5"
      >
        <article
          v-for="product in visibleProducts"
          :key="product.id"
          class="group overflow-hidden rounded-2xl border border-black/[0.05] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-[0_10px_28px_rgba(0,62,170,0.1)] dark:border-border dark:bg-card"
        >
          <a
            :href="`/product/${product.slug}`"
            class="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <!-- 1:1 image like marketplace tiles -->
            <div class="relative aspect-square overflow-hidden bg-[#eef2f7] dark:bg-muted">
              <img
                :src="product.coverImage || defaultProductImage"
                :alt="product.name"
                loading="lazy"
                decoding="async"
                :class="product.availableStock === 0 ? 'opacity-40 grayscale' : ''"
                class="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
              />
              <span
                v-if="product.categoryName"
                class="absolute left-1.5 top-1.5 max-w-[75%] truncate rounded-md bg-white/92 px-1.5 py-0.5 text-[10px] font-medium leading-none text-foreground/75 shadow-sm backdrop-blur dark:bg-background/90"
              >
                {{ product.categoryName }}
              </span>
              <span
                v-if="product.availableStock === 0"
                class="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-center text-[10px] font-semibold tracking-wide text-white"
              >
                {{ messages.storefront.outOfStock }}
              </span>
            </div>

            <div class="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
              <h3 class="line-clamp-2 min-h-[2.4em] text-[12.5px] font-medium leading-snug text-foreground group-hover:text-brand sm:text-[13px]">
                {{ product.name }}
              </h3>
              <p v-if="product.subtitle" class="line-clamp-1 text-[11px] text-muted-foreground">
                {{ product.subtitle }}
              </p>
              <!-- Price: always one line (RM + amount) -->
              <div class="mt-auto flex items-end justify-between gap-2 pt-1.5">
                <span class="flex min-w-0 items-baseline gap-0.5 whitespace-nowrap font-bold tabular-nums leading-none text-brand">
                  <span class="text-[10px] font-semibold opacity-80 sm:text-[11px]">RM</span>
                  <span class="text-[15px] sm:text-[16px]">{{ product.price }}</span>
                </span>
                <span :class="stockClass(product)" class="shrink-0 text-[10px] leading-none sm:text-[11px]">
                  {{ stockLabel(product) }}
                </span>
              </div>
            </div>
          </a>
        </article>
      </div>

      <div
        v-else
        class="mt-2 rounded-2xl border border-dashed border-black/10 bg-white px-6 py-16 text-center dark:bg-card"
      >
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
    "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors sm:px-4 sm:text-[13px]",
    active
      ? "bg-brand text-white shadow-sm"
      : "bg-[#eef2f7] text-foreground/70 hover:bg-[#e4eaf3] hover:text-foreground dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80 dark:hover:text-foreground",
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
/* h-13 ≈ 3.25rem for tighter mobile header */
.h-13 { height: 3.25rem; }
.pt-13 { padding-top: 3.25rem; }
.top-13 { top: 3.25rem; }
</style>
