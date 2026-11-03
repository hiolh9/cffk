<template>
  <main class="flex min-h-screen flex-col bg-background text-foreground">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-border bg-background">
      <div class="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-3 px-3 sm:h-14 sm:px-4">
        <StorefrontBrand />
        <div class="relative hidden min-w-0 flex-1 md:block md:max-w-sm lg:max-w-md">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            type="search"
            class="h-9 rounded-md border-transparent bg-muted pl-9 text-sm shadow-none focus-visible:border-brand focus-visible:ring-0"
            :placeholder="messages.storefront.searchProducts"
          />
        </div>
        <PublicNav />
      </div>
    </header>

    <!-- Notice -->
    <div v-if="site.notice" class="border-b border-border bg-muted/60">
      <div class="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground sm:px-4">
        <InfoIcon class="size-3.5 shrink-0 text-brand" />
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

    <div class="mx-auto w-full max-w-[1400px] flex-1 px-3 sm:px-4">
      <!-- Banner -->
      <section v-if="bannerSlides.length" class="group relative mt-3 overflow-hidden rounded-lg bg-muted">
        <div class="flex transition-transform duration-500 ease-out" :style="{ transform: 'translateX(-' + bannerIndex * 100 + '%)' }">
          <a
            v-for="slide in bannerSlides"
            :key="slide.id"
            :href="slide.href"
            class="relative block h-36 w-full shrink-0 sm:h-48 lg:h-60"
          >
            <img :src="slide.image" :alt="slide.title" class="h-full w-full object-cover" loading="lazy" />
            <div v-if="slide.title" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-10">
              <h2 class="line-clamp-1 text-base font-semibold text-white sm:text-xl">{{ slide.title }}</h2>
              <p v-if="slide.subtitle" class="mt-0.5 line-clamp-1 text-xs text-white/80 sm:text-sm">{{ slide.subtitle }}</p>
            </div>
          </a>
        </div>
        <template v-if="bannerSlides.length > 1">
          <button
            type="button"
            class="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-md bg-background/90 text-foreground opacity-0 transition group-hover:opacity-100 sm:flex"
            aria-label="Prev"
            @click.prevent="nextBanner(-1)"
          >
            <ChevronLeftIcon class="size-4" />
          </button>
          <button
            type="button"
            class="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-md bg-background/90 text-foreground opacity-0 transition group-hover:opacity-100 sm:flex"
            aria-label="Next"
            @click.prevent="nextBanner(1)"
          >
            <ChevronRightIcon class="size-4" />
          </button>
          <span class="absolute right-3 top-3 rounded bg-black/50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {{ bannerIndex + 1 }} / {{ bannerSlides.length }}
          </span>
        </template>
      </section>

      <!-- Mobile search -->
      <div class="pt-3 md:hidden">
        <div class="relative">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            type="search"
            class="h-10 rounded-md border-transparent bg-muted pl-9 text-sm shadow-none focus-visible:border-brand focus-visible:ring-0"
            :placeholder="messages.storefront.searchProducts"
          />
        </div>
      </div>

      <!-- Categories -->
      <nav v-if="data.categories.length" class="sticky top-12 z-40 -mx-3 mt-3 border-b border-border bg-background px-3 sm:top-14 sm:-mx-4 sm:px-4">
        <div class="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" :class="tabClass(selectedCategory === null)" @click="selectedCategory = null">{{ messages.storefront.all }}</button>
          <button
            v-for="c in data.categories"
            :key="c.id"
            type="button"
            :class="tabClass(selectedCategory === c.id)"
            @click="selectedCategory = c.id"
          >
            {{ c.name }}
          </button>
        </div>
      </nav>

      <!-- Flash deals: horizontal strip -->
      <section v-if="flashProducts.length" class="mt-6">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-1.5 text-base font-semibold">
            <ZapIcon class="size-4 text-orange-500" />
            Flash Deals
          </h2>
          <p class="m-0 text-xs text-muted-foreground">
            Ends in
            <span class="ml-1 font-mono text-sm font-medium tabular-nums text-foreground">{{ flashCountdown.h }}:{{ flashCountdown.m }}:{{ flashCountdown.s }}</span>
          </p>
        </div>
        <ul class="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <li v-for="p in flashProducts" :key="'f' + p.id" class="w-36 shrink-0 snap-start sm:w-44">
            <a :href="'/product/' + p.slug" class="group block">
              <div class="relative aspect-square overflow-hidden rounded-md bg-muted">
                <img
                  :src="p.coverImage || defaultProductImage"
                  :alt="p.name"
                  class="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <span v-if="dealBadge(p)" class="absolute left-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">{{ dealBadge(p) }}</span>
              </div>
              <h3 class="mt-2 line-clamp-2 text-sm leading-snug">{{ p.name }}</h3>
              <p class="mt-1 text-base font-semibold tabular-nums"><span class="mr-0.5 text-xs font-medium text-muted-foreground">RM</span>{{ p.price }}</p>
            </a>
          </li>
        </ul>
      </section>

      <!-- Hot products: ranked list -->
      <section v-if="hotProducts.length" class="mt-8">
        <h2 class="mb-1 flex items-center gap-1.5 text-base font-semibold">
          <FlameIcon class="size-4 text-brand" />
          Hot Products
        </h2>
        <ol class="m-0 grid list-none p-0 md:grid-cols-2 md:gap-x-10">
          <li v-for="(p, i) in hotProducts" :key="'h' + p.id" class="border-b border-border">
            <a :href="'/product/' + p.slug" class="group flex items-center gap-3 py-3">
              <span class="w-5 shrink-0 text-center text-lg font-semibold tabular-nums" :class="i < 3 ? 'text-brand' : 'text-muted-foreground/60'">{{ i + 1 }}</span>
              <img
                :src="p.coverImage || defaultProductImage"
                :alt="p.name"
                class="size-14 shrink-0 rounded-md bg-muted object-cover"
                loading="lazy"
                width="56"
                height="56"
              />
              <div class="min-w-0 flex-1">
                <h3 class="line-clamp-1 text-sm font-medium group-hover:text-brand">{{ p.name }}</h3>
                <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ p.subtitle }}</p>
              </div>
              <p class="m-0 shrink-0 text-sm font-semibold tabular-nums"><span class="mr-0.5 text-xs font-medium text-muted-foreground">RM</span>{{ p.price }}</p>
            </a>
          </li>
        </ol>
      </section>

      <!-- All products: grid -->
      <section class="mb-12 mt-10">
        <div class="mb-4 flex items-baseline justify-between gap-2">
          <h2 class="text-base font-semibold">{{ messages.storefront.products }}</h2>
          <p class="m-0 text-xs text-muted-foreground">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</p>
        </div>
        <ul v-if="visibleProducts.length" class="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-6 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <li v-for="p in visibleProducts" :key="p.id">
            <a :href="'/product/' + p.slug" class="group block">
              <div class="relative aspect-square overflow-hidden rounded-md bg-muted">
                <img
                  :src="p.coverImage || defaultProductImage"
                  :alt="p.name"
                  class="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  :class="p.availableStock === 0 ? 'opacity-50' : ''"
                  loading="lazy"
                />
                <span v-if="dealBadge(p)" class="absolute left-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">{{ dealBadge(p) }}</span>
              </div>
              <h3 class="mt-2 line-clamp-2 text-sm leading-snug group-hover:text-brand">{{ p.name }}</h3>
              <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ p.subtitle }}</p>
              <div class="mt-1.5 flex items-baseline justify-between gap-2">
                <p class="m-0 text-base font-semibold tabular-nums"><span class="mr-0.5 text-xs font-medium text-muted-foreground">RM</span>{{ p.price }}</p>
                <span class="text-xs" :class="stockClass(p)">{{ stockLabel(p) }}</span>
              </div>
            </a>
          </li>
        </ul>
        <p v-else class="py-16 text-center text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
      </section>
    </div>

    <StorefrontFooter />
  </main>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ChevronLeftIcon, ChevronRightIcon, FlameIcon, InfoIcon, SearchIcon, ZapIcon } from "@lucide/vue";
import { useData } from "vike-vue/useData";
import { usePageContext } from "vike-vue/usePageContext";
import PublicNav from "@/components/storefront/PublicNav.vue";
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";
import { Input } from "@/components/ui/input";
import type { Data } from "./+data.server";
import { useStorefrontPreferences } from "@/lib/storefront-preferences";
import defaultProductImage from "@/assets/product_img.jpg?url";

type Product = Data["products"][number];
type Site = {
  name: string;
  subtitle: string | null;
  logo: string | null;
  notice: string | null;
  footerText: string | null;
  homeBannersJson?: string | null;
};
type BannerSlide = { id: string; title: string; subtitle?: string; image: string; href: string };

const data = useData<Data>();
const pageContext = usePageContext() as unknown as { site: Site };
const site = pageContext.site;
const { messages, t } = useStorefrontPreferences();
const selectedCategory = ref<number | null>(null);
const query = ref("");

const visibleProducts = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return data.products.filter(
    (p) =>
      (selectedCategory.value === null || p.categoryId === selectedCategory.value) &&
      (!keyword ||
        p.name.toLowerCase().includes(keyword) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(keyword))),
  );
});

const bannerIndex = ref(0);
let bannerTimer: ReturnType<typeof setInterval> | null = null;

function parseCustomBanners(): BannerSlide[] {
  const raw = site.homeBannersJson?.trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Array<{ image?: string; title?: string; subtitle?: string; href?: string; link?: string }>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.image === "string" && x.image.trim())
      .slice(0, 10)
      .map((x, i) => ({
        id: "c-" + i,
        title: String(x.title || "").trim(),
        subtitle: String(x.subtitle || "").trim(),
        image: String(x.image).trim(),
        href: String(x.href || x.link || "/").trim() || "/",
      }));
  } catch {
    return [];
  }
}

const bannerSlides = computed(() => {
  const custom = parseCustomBanners();
  if (custom.length) return custom;
  const withImg = data.products.filter((p) => p.coverImage);
  const list = (withImg.length ? withImg : data.products).slice(0, 5);
  return list.map((p) => ({
    id: "p-" + p.id,
    title: p.name,
    subtitle: p.subtitle || "",
    image: p.coverImage || defaultProductImage,
    href: "/product/" + p.slug,
  }));
});

const flashProducts = computed(() => visibleProducts.value.slice(0, 8));
const hotProducts = computed(() => {
  const rest = visibleProducts.value.slice(8, 14);
  return rest.length ? rest : visibleProducts.value.slice(0, 6);
});

const flashEndsAt = computed(() => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
});
const nowTick = ref(Date.now());
let tickTimer: ReturnType<typeof setInterval> | null = null;
const flashCountdown = computed(() => {
  const ms = Math.max(0, flashEndsAt.value - nowTick.value);
  const s = Math.floor(ms / 1000);
  return {
    h: String(Math.floor(s / 3600)).padStart(2, "0"),
    m: String(Math.floor((s % 3600) / 60)).padStart(2, "0"),
    s: String(s % 60).padStart(2, "0"),
  };
});

function dealBadge(product: Product) {
  const m = product.subtitle?.match(/(\d+)\s*%/);
  return m ? "-" + m[1] + "%" : null;
}
function nextBanner(dir: number) {
  const n = bannerSlides.value.length;
  if (n) bannerIndex.value = (bannerIndex.value + dir + n) % n;
}
function tabClass(active: boolean) {
  return [
    "shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors",
    active
      ? "border-brand font-medium text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  ];
}
function stockLabel(product: Product) {
  if (product.availableStock === null) return messages.value.storefront.stockAvailable;
  return product.availableStock > 0
    ? t(messages.value.storefront.stockCount, { count: product.availableStock })
    : messages.value.storefront.outOfStock;
}
function stockClass(product: Product) {
  return product.availableStock === 0 ? "font-medium text-orange-600" : "text-muted-foreground";
}

onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
  bannerTimer = setInterval(() => {
    if (bannerSlides.value.length > 1) nextBanner(1);
  }, 5500);
});
onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
  if (bannerTimer) clearInterval(bannerTimer);
});
</script>
