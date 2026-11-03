<template>
  <!--
    Dark "gaming marketplace" layout (SEAGM / Codashop style).
    The `dark` class makes StorefrontBrand, PublicNav and StorefrontFooter
    switch to their dark tokens too. Remove it (and the hard-coded navy
    colours) if you want the page to follow the visitor's theme instead.
  -->
  <main class="dark flex min-h-screen flex-col bg-[#0b1224] text-slate-100">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-white/10 bg-[#0e1730]">
      <div class="mx-auto flex h-12 max-w-[1280px] items-center justify-between gap-3 px-3 sm:h-14">
        <StorefrontBrand />
        <div class="relative hidden min-w-0 flex-1 md:block md:max-w-xl">
          <SearchIcon class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            v-model="query"
            type="search"
            class="h-9 rounded-full border-white/10 bg-[#131c36] pl-10 text-sm text-slate-100 shadow-none placeholder:text-slate-500 focus-visible:border-[#0088EE] focus-visible:ring-0"
            :placeholder="messages.storefront.searchProducts"
          />
        </div>
        <PublicNav />
      </div>
    </header>

    <!-- Notice -->
    <div v-if="site.notice" class="border-b border-white/5 bg-[#0088EE]/10">
      <div class="mx-auto flex max-w-[1280px] items-center gap-2 px-3 py-1.5 text-[13px] text-slate-300">
        <MegaphoneIcon class="size-3.5 shrink-0 text-[#4db3ff]" />
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

    <!-- Categories (sticky tab bar) -->
    <nav v-if="data.categories.length" class="sticky top-12 z-40 border-b border-white/10 bg-[#0b1224]/95 backdrop-blur sm:top-14">
      <div class="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" :class="tabClass(selectedCategory === null)" @click="selectedCategory = null">{{ messages.storefront.all }}</button>
        <button v-for="c in data.categories" :key="c.id" type="button" :class="tabClass(selectedCategory === c.id)" @click="selectedCategory = c.id">
          {{ c.name }}
        </button>
      </div>
    </nav>

    <div class="mx-auto w-full max-w-[1280px] flex-1 space-y-6 px-3 pb-10 pt-4">
      <!-- Mobile search -->
      <div class="relative md:hidden">
        <SearchIcon class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          v-model="query"
          type="search"
          class="h-10 rounded-full border-white/10 bg-[#131c36] pl-10 text-sm text-slate-100 shadow-none placeholder:text-slate-500 focus-visible:border-[#0088EE] focus-visible:ring-0"
          :placeholder="messages.storefront.searchProducts"
        />
      </div>

      <!-- Hero -->
      <section v-if="bannerSlides.length" class="group relative overflow-hidden rounded-xl bg-[#131c36]">
        <div class="flex transition-transform duration-500 ease-out" :style="{ transform: 'translateX(-' + bannerIndex * 100 + '%)' }">
          <a v-for="slide in bannerSlides" :key="slide.id" :href="slide.href" class="relative block h-44 w-full shrink-0 sm:h-64 lg:h-[340px]">
            <img :src="slide.image" :alt="slide.title" class="size-full object-cover" loading="lazy" />
            <div v-if="slide.title" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1224] via-[#0b1224]/60 to-transparent px-4 pb-8 pt-16 sm:px-6">
              <h2 class="line-clamp-1 text-lg font-bold text-white sm:text-2xl">{{ slide.title }}</h2>
              <p v-if="slide.subtitle" class="mt-1 line-clamp-1 text-xs text-slate-300 sm:text-sm">{{ slide.subtitle }}</p>
            </div>
          </a>
        </div>
        <template v-if="bannerSlides.length > 1">
          <button type="button" class="absolute left-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100 sm:flex" aria-label="Prev" @click.prevent="nextBanner(-1)">
            <ChevronLeftIcon class="size-5" />
          </button>
          <button type="button" class="absolute right-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100 sm:flex" aria-label="Next" @click.prevent="nextBanner(1)">
            <ChevronRightIcon class="size-5" />
          </button>
          <div class="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            <button
              v-for="(_, i) in bannerSlides"
              :key="i"
              type="button"
              class="h-1.5 rounded-full transition-all"
              :class="i === bannerIndex ? 'w-6 bg-[#0088EE]' : 'w-1.5 bg-white/40'"
              @click.prevent="bannerIndex = i"
            />
          </div>
        </template>
      </section>

      <!-- Flash deals -->
      <section v-if="flashProducts.length">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 text-base font-bold sm:text-lg">
            <ZapIcon class="size-[18px] fill-red-500 text-red-500" />
            {{ L("flashDeals", "Flash Deals") }}
          </h2>
          <div class="flex items-center gap-2 text-xs text-slate-400">
            <span>{{ L("endsIn", "Ends in") }}</span>
            <div class="flex items-center gap-1 font-mono text-[13px] font-bold tabular-nums">
              <span class="rounded bg-red-500 px-1.5 py-0.5 text-white">{{ flashCountdown.h }}</span>
              <span class="text-red-400">:</span>
              <span class="rounded bg-red-500 px-1.5 py-0.5 text-white">{{ flashCountdown.m }}</span>
              <span class="text-red-400">:</span>
              <span class="rounded bg-red-500 px-1.5 py-0.5 text-white">{{ flashCountdown.s }}</span>
            </div>
          </div>
        </div>
        <ul class="-mx-3 m-0 flex snap-x list-none gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <li v-for="p in flashProducts" :key="'f' + p.id" class="w-[140px] shrink-0 snap-start sm:w-[172px]">
            <a :href="'/product/' + p.slug" class="group block rounded-xl border border-white/[0.07] bg-[#131c36] p-2 transition hover:border-[#0088EE]/60">
              <div class="relative aspect-square overflow-hidden rounded-lg bg-[#0b1224]">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                <span v-if="dealBadge(p)" class="absolute left-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{{ dealBadge(p) }}</span>
              </div>
              <h3 class="mt-2 line-clamp-1 text-[13px] font-medium">{{ p.name }}</h3>
              <p class="mt-0.5 text-[15px] font-bold tabular-nums text-[#4db3ff]"><span class="mr-px text-[11px] font-semibold text-slate-400">RM</span>{{ p.price }}</p>
              <p v-if="lowStock(p)" class="mt-0.5 text-[11px] font-medium text-red-400">{{ t(L("itemsLeft", "{count} left"), { count: p.availableStock }) }}</p>
            </a>
          </li>
        </ul>
      </section>

      <!-- Popular -->
      <section v-if="popularProducts.length">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 text-base font-bold sm:text-lg">
            <span class="h-4 w-1 rounded-full bg-[#0088EE]" />
            {{ L("hotProducts", "Hot Products") }}
          </h2>
          <a href="#all-products" class="flex items-center text-[13px] text-[#4db3ff] hover:underline">
            {{ L("viewAll", "View all") }}<ChevronRightIcon class="size-4" />
          </a>
        </div>
        <ul class="m-0 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4 md:grid-cols-6">
          <li v-for="p in popularProducts" :key="'p' + p.id">
            <a :href="'/product/' + p.slug" class="group block text-center">
              <div class="aspect-square overflow-hidden rounded-2xl border border-white/[0.07] bg-[#131c36] transition group-hover:border-[#0088EE]/60">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
              </div>
              <h3 class="mt-2 line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-[#4db3ff]">{{ p.name }}</h3>
            </a>
          </li>
        </ul>
      </section>

      <!-- All products -->
      <section id="all-products" class="scroll-mt-28">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-baseline gap-2">
            <h2 class="flex shrink-0 items-center gap-2 text-base font-bold sm:text-lg">
              <span class="h-4 w-1 rounded-full bg-[#0088EE]" />
              {{ messages.storefront.products }}
            </h2>
            <span class="truncate text-xs text-slate-500">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</span>
          </div>
          <div class="flex shrink-0 rounded-lg bg-[#131c36] p-0.5 text-xs">
            <button v-for="s in sortOptions" :key="s.key" type="button" :class="sortClass(sort === s.key)" @click="sort = s.key">
              {{ L(s.labelKey, s.fallback) }}
            </button>
          </div>
        </div>

        <ul v-if="sortedProducts.length" class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <li v-for="p in sortedProducts" :key="p.id">
            <a :href="'/product/' + p.slug" class="group flex h-full flex-col rounded-xl border border-white/[0.07] bg-[#131c36] p-2 transition hover:-translate-y-0.5 hover:border-[#0088EE]/60">
              <div class="relative aspect-square overflow-hidden rounded-lg bg-[#0b1224]">
                <img
                  :src="p.coverImage || defaultProductImage"
                  :alt="p.name"
                  class="size-full object-cover transition duration-300 group-hover:scale-105"
                  :class="p.availableStock === 0 ? 'opacity-40 grayscale' : ''"
                  loading="lazy"
                />
                <span v-if="dealBadge(p)" class="absolute left-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{{ dealBadge(p) }}</span>
              </div>
              <div class="flex flex-1 flex-col px-0.5 pb-0.5 pt-2">
                <h3 class="line-clamp-2 text-[13px] font-medium leading-snug">{{ p.name }}</h3>
                <p v-if="p.subtitle" class="mt-1 line-clamp-1 text-[11px] text-slate-500">{{ p.subtitle }}</p>
                <div class="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 pt-2">
                  <p class="m-0 text-[15px] font-bold tabular-nums text-[#4db3ff]"><span class="mr-px text-[11px] font-semibold text-slate-400">RM</span>{{ p.price }}</p>
                  <span class="text-[11px]" :class="stockClass(p)">{{ stockLabel(p) }}</span>
                </div>
              </div>
            </a>
          </li>
        </ul>
        <p v-else class="rounded-xl bg-[#131c36] py-16 text-center text-sm text-slate-400">{{ messages.storefront.noProducts }}</p>
      </section>
    </div>

    <StorefrontFooter />
  </main>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ChevronLeftIcon, ChevronRightIcon, MegaphoneIcon, SearchIcon, ZapIcon } from "@lucide/vue";
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
type SortKey = "default" | "asc" | "desc";

const data = useData<Data>();
const pageContext = usePageContext() as unknown as { site: Site };
const site = pageContext.site;
const { messages, t } = useStorefrontPreferences();
const selectedCategory = ref<number | null>(null);
const query = ref("");
const sort = ref<SortKey>("default");

/**
 * i18n: reads messages.storefront[key], falls back to English when the key
 * isn't in your message files yet. Keys to add to every locale:
 *   flashDeals, hotProducts, endsIn, itemsLeft ("{count} left"), viewAll,
 *   sortPopular, sortPriceAsc, sortPriceDesc
 */
function L(key: string, fallback: string): string {
  const sf = messages.value.storefront as unknown as Record<string, string | undefined>;
  return sf[key] ?? fallback;
}

const sortOptions: { key: SortKey; labelKey: string; fallback: string }[] = [
  { key: "default", labelKey: "sortPopular", fallback: "Popular" },
  { key: "asc", labelKey: "sortPriceAsc", fallback: "Price ↑" },
  { key: "desc", labelKey: "sortPriceDesc", fallback: "Price ↓" },
];

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

const sortedProducts = computed(() => {
  if (sort.value === "default") return visibleProducts.value;
  const dir = sort.value === "asc" ? 1 : -1;
  return [...visibleProducts.value].sort((a, b) => (Number(a.price) - Number(b.price)) * dir);
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

const flashProducts = computed(() => visibleProducts.value.slice(0, 10));
const popularProducts = computed(() => {
  const rest = visibleProducts.value.slice(10, 22);
  return rest.length ? rest : visibleProducts.value.slice(0, 12);
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
function lowStock(product: Product) {
  return product.availableStock !== null && product.availableStock > 0 && product.availableStock <= 20;
}
function nextBanner(dir: number) {
  const n = bannerSlides.value.length;
  if (n) bannerIndex.value = (bannerIndex.value + dir + n) % n;
}
function tabClass(active: boolean) {
  return [
    "shrink-0 border-b-2 px-3.5 py-3 text-sm transition-colors",
    active ? "border-[#0088EE] font-semibold text-white" : "border-transparent text-slate-400 hover:text-slate-200",
  ];
}
function sortClass(active: boolean) {
  return [
    "rounded-md px-2.5 py-1 font-medium transition-colors",
    active ? "bg-[#0088EE] text-white" : "text-slate-400 hover:text-slate-200",
  ];
}
function stockLabel(product: Product) {
  if (product.availableStock === null) return messages.value.storefront.stockAvailable;
  return product.availableStock > 0
    ? t(messages.value.storefront.stockCount, { count: product.availableStock })
    : messages.value.storefront.outOfStock;
}
function stockClass(product: Product) {
  return product.availableStock === 0 ? "font-medium text-red-400" : "text-slate-500";
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
