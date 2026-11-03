<template>
  <main class="flex min-h-screen flex-col bg-[#f2f4f8] text-foreground dark:bg-background">
  
    <div v-if="site.notice" class="border-b border-border bg-background">
      <div class="mx-auto flex max-w-[1280px] items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
        <MegaphoneIcon class="size-3.5 shrink-0 text-brand" />
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

   
    <header class="sticky top-0 z-50 border-b border-border bg-background">
      <div class="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-3">
        <StorefrontBrand />
        <div class="relative hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-lg">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            type="search"
            class="h-9 rounded-full border-transparent bg-muted pl-9 text-sm shadow-none focus-visible:border-brand focus-visible:ring-0"
            :placeholder="messages.storefront.searchProducts"
          />
        </div>
        <PublicNav />
      </div>
      <nav v-if="data.categories.length" class="mx-auto max-w-[1280px] px-1">
        <div class="flex gap-0.5 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" :class="tabClass(selectedCategory === null)" @click="selectedCategory = null">{{ messages.storefront.all }}</button>
          <button v-for="c in data.categories" :key="c.id" type="button" :class="tabClass(selectedCategory === c.id)" @click="selectedCategory = c.id">
            {{ c.name }}
          </button>
        </div>
      </nav>
    </header>

  
    <section v-if="!isFiltering && (bannerSlides.length || dealProducts.length)" class="relative overflow-hidden">
      <div v-if="currentBanner" class="pointer-events-none absolute inset-0">
        <img :key="currentBanner.id" :src="currentBanner.image" alt="" class="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-3xl" />
        <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#f2f4f8]/50 to-[#f2f4f8] dark:via-background/50 dark:to-background" />
      </div>

      <div class="relative mx-auto max-w-[1280px] px-3 pb-4 pt-3 sm:pt-5">
        <!-- Slider -->
        <div v-if="bannerSlides.length" class="group relative -mx-3" @mouseenter="paused = true" @mouseleave="paused = false">
          <div
            ref="slidesEl"
            class="relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[7%] sm:px-[11%] lg:px-[calc(50%-500px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            @scroll.passive="onBannerScroll"
          >
            <a
              v-for="(slide, i) in bannerSlides"
              :key="slide.id"
              :href="slide.href"
              class="relative h-40 w-[86%] shrink-0 snap-center overflow-hidden rounded-xl bg-muted shadow-sm transition-opacity duration-300 sm:h-56 sm:w-[78%] lg:h-[360px] lg:w-[1000px]"
              :class="i === bannerIndex ? 'opacity-100' : 'opacity-50'"
            >
              <img :src="slide.image" :alt="slide.title" class="size-full object-cover" :loading="i === 0 ? 'eager' : 'lazy'" />
              <div v-if="slide.title" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4 pt-14">
                <h2 class="line-clamp-1 text-base font-bold text-white sm:text-xl">{{ slide.title }}</h2>
                <p v-if="slide.subtitle" class="mt-0.5 line-clamp-1 text-xs text-white/80 sm:text-sm">{{ slide.subtitle }}</p>
              </div>
            </a>
          </div>
          <template v-if="bannerSlides.length > 1">
            <button type="button" class="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow transition hover:bg-background sm:flex lg:left-[calc(50%-540px)]" aria-label="Prev" @click.prevent="nextBanner(-1)">
              <ChevronLeftIcon class="size-5" />
            </button>
            <button type="button" class="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow transition hover:bg-background sm:flex lg:right-[calc(50%-540px)]" aria-label="Next" @click.prevent="nextBanner(1)">
              <ChevronRightIcon class="size-5" />
            </button>
            <div class="mt-3 flex justify-center gap-1.5">
              <button
                v-for="(_, i) in bannerSlides"
                :key="i"
                type="button"
                class="h-1.5 rounded-full transition-all"
                :class="i === bannerIndex ? 'w-5 bg-brand' : 'w-1.5 bg-foreground/25'"
                :aria-label="'Slide ' + (i + 1)"
                @click.prevent="goTo(i)"
              />
            </div>
          </template>
        </div>

      
        <div v-if="dealProducts.length" class="mt-4 rounded-xl bg-card p-3 shadow-sm sm:p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h2 class="flex items-center gap-1.5 text-base font-bold">
                <ZapIcon class="size-4 fill-red-500 text-red-500" />
                {{ L("flashDeals", "Flash Deals") }}
              </h2>
              <p class="m-0 mt-0.5 truncate text-xs text-muted-foreground">{{ L("flashDealsSub", "Limited time only!") }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span class="hidden sm:inline">{{ L("endsIn", "Ends in") }}</span>
              <div class="flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums">
                <span class="rounded bg-foreground px-1.5 py-0.5 text-background">{{ flashCountdown.h }}</span>:
                <span class="rounded bg-foreground px-1.5 py-0.5 text-background">{{ flashCountdown.m }}</span>:
                <span class="rounded bg-foreground px-1.5 py-0.5 text-background">{{ flashCountdown.s }}</span>
              </div>
            </div>
          </div>
          <ul class="m-0 grid list-none auto-cols-[248px] grid-flow-col grid-rows-2 gap-3 overflow-x-auto p-0 pb-1 [scrollbar-width:none] lg:grid-rows-1 [&::-webkit-scrollbar]:hidden">
            <li v-for="p in dealProducts" :key="'d' + p.id">
              <a :href="'/product/' + p.slug" class="group flex items-center gap-2.5 rounded-lg border border-border bg-background p-2 transition hover:border-brand/50">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-[54px] shrink-0 rounded-lg bg-muted object-cover" loading="lazy" width="54" height="54" />
                <div class="min-w-0 flex-1">
                  <h3 class="line-clamp-1 text-[13px] font-medium">{{ p.name }}</h3>
                  <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{{ p.subtitle }}</p>
                </div>
                <div class="shrink-0 text-right">
                  <span v-if="dealBadge(p)" class="inline-block rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{{ dealBadge(p) }}</span>
                  <span v-else-if="lowStock(p)" class="inline-block text-[11px] font-medium text-red-500">{{ t(L("itemsLeft", "{count} left"), { count: p.availableStock }) }}</span>
                  <p class="m-0 mt-0.5 text-sm font-bold tabular-nums"><span class="mr-px text-[10px] font-semibold text-muted-foreground">RM</span>{{ p.price }}</p>
                </div>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <div class="mx-auto w-full max-w-[1280px] flex-1 space-y-4 px-3 pb-10" :class="isFiltering ? 'pt-4' : ''">
      <!-- Mobile search -->
      <div class="relative md:hidden" :class="isFiltering ? '' : '-mt-1'">
        <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="query"
          type="search"
          class="h-10 rounded-full border-border bg-background pl-9 text-sm shadow-none focus-visible:border-brand focus-visible:ring-0"
          :placeholder="messages.storefront.searchProducts"
        />
      </div>

      <section v-if="!isFiltering && featuredColumns.length" class="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        <div v-for="col in featuredColumns" :key="'col' + col.id" class="w-[86%] shrink-0 snap-start rounded-xl bg-card p-3 shadow-sm md:w-auto">
          <div class="flex items-center justify-between gap-2">
            <h3 class="line-clamp-1 text-[15px] font-bold">{{ col.title }}</h3>
            <button v-if="col.id !== null" type="button" class="flex shrink-0 items-center text-xs text-brand hover:underline" @click="openCategory(col.id)">
              {{ L("viewAll", "View all") }}<ChevronRightIcon class="size-3.5" />
            </button>
          </div>
          <ul class="m-0 mt-1 list-none p-0">
            <li v-for="p in col.products" :key="'c' + p.id" class="border-t border-border first:border-t-0">
              <a :href="'/product/' + p.slug" class="group flex items-center gap-3 py-2.5">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-[52px] shrink-0 rounded-xl bg-muted object-cover" loading="lazy" width="52" height="52" />
                <div class="min-w-0 flex-1">
                  <h4 class="line-clamp-1 text-[13px] font-medium group-hover:text-brand">{{ p.name }}</h4>
                  <p class="m-0 mt-1 flex items-center gap-2 text-xs">
                    <span class="font-bold tabular-nums"><span class="mr-px text-[10px] font-semibold text-muted-foreground">RM</span>{{ p.price }}</span>
                    <span :class="stockClass(p)">{{ stockLabel(p) }}</span>
                  </p>
                </div>
              </a>
            </li>
          </ul>
        </div>
      </section>

      <!-- All products / search results -->
      <section id="all-products" class="scroll-mt-28">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-baseline gap-2">
            <h2 class="shrink-0 text-base font-bold">{{ messages.storefront.products }}</h2>
            <span class="truncate text-xs text-muted-foreground">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</span>
          </div>
          <div class="flex shrink-0 rounded-lg bg-muted p-0.5 text-xs">
            <button v-for="s in sortOptions" :key="s.key" type="button" :class="sortClass(sort === s.key)" @click="sort = s.key">
              {{ L(s.labelKey, s.fallback) }}
            </button>
          </div>
        </div>

        <ul v-if="sortedProducts.length" class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <li v-for="p in sortedProducts" :key="p.id">
            <a :href="'/product/' + p.slug" class="group flex h-full flex-col rounded-xl bg-card p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div class="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <img
                  :src="p.coverImage || defaultProductImage"
                  :alt="p.name"
                  class="size-full object-cover transition duration-300 group-hover:scale-105"
                  :class="p.availableStock === 0 ? 'opacity-50 grayscale' : ''"
                  loading="lazy"
                />
                <span v-if="dealBadge(p)" class="absolute left-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{{ dealBadge(p) }}</span>
              </div>
              <div class="flex flex-1 flex-col px-0.5 pb-0.5 pt-2">
                <h3 class="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-brand">{{ p.name }}</h3>
                <p v-if="p.subtitle" class="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{{ p.subtitle }}</p>
                <div class="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 pt-2">
                  <p class="m-0 text-[15px] font-bold tabular-nums"><span class="mr-px text-[11px] font-semibold text-muted-foreground">RM</span>{{ p.price }}</p>
                  <span class="text-[11px]" :class="stockClass(p)">{{ stockLabel(p) }}</span>
                </div>
              </div>
            </a>
          </li>
        </ul>
        <p v-else class="rounded-xl bg-card py-16 text-center text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
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
 *   flashDeals, flashDealsSub, endsIn, itemsLeft ("{count} left"), viewAll,
 *   hotProducts, sortPopular, sortPriceAsc, sortPriceDesc
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

/* ---------- products ---------- */
const isFiltering = computed(() => query.value.trim() !== "" || selectedCategory.value !== null);

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

const dealProducts = computed(() => data.products.slice(0, 10));

const featuredColumns = computed<{ id: number | null; title: string; products: Product[] }[]>(() => {
  const cols = data.categories
    .slice(0, 4)
    .map((c) => ({ id: c.id as number | null, title: c.name, products: data.products.filter((p) => p.categoryId === c.id).slice(0, 6) }))
    .filter((c) => c.products.length > 0);
  if (cols.length) return cols;
  return data.products.length ? [{ id: null, title: L("hotProducts", "Hot Products"), products: data.products.slice(0, 6) }] : [];
});

function openCategory(id: number) {
  selectedCategory.value = id;
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- banner ---------- */
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

const bannerSlides = computed<BannerSlide[]>(() => {
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

const slidesEl = ref<HTMLElement | null>(null);
const bannerIndex = ref(0);
const paused = ref(false);
const currentBanner = computed(() => bannerSlides.value[bannerIndex.value] ?? null);

function goTo(i: number) {
  const box = slidesEl.value;
  const slide = box?.children[i] as HTMLElement | undefined;
  if (!box || !slide) return;
  box.scrollTo({ left: slide.offsetLeft + slide.clientWidth / 2 - box.clientWidth / 2, behavior: "smooth" });
}
function nextBanner(dir: number) {
  const n = bannerSlides.value.length;
  if (n) goTo((bannerIndex.value + dir + n) % n);
}
function onBannerScroll() {
  const box = slidesEl.value;
  if (!box) return;
  const center = box.scrollLeft + box.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  (Array.from(box.children) as HTMLElement[]).forEach((el, i) => {
    const dist = Math.abs(el.offsetLeft + el.clientWidth / 2 - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  bannerIndex.value = best;
}

/* ---------- countdown ---------- */
const flashEndsAt = computed(() => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
});
const nowTick = ref(Date.now());
const flashCountdown = computed(() => {
  const ms = Math.max(0, flashEndsAt.value - nowTick.value);
  const s = Math.floor(ms / 1000);
  return {
    h: String(Math.floor(s / 3600)).padStart(2, "0"),
    m: String(Math.floor((s % 3600) / 60)).padStart(2, "0"),
    s: String(s % 60).padStart(2, "0"),
  };
});

/* ---------- helpers ---------- */
function dealBadge(product: Product) {
  const m = product.subtitle?.match(/(\d+)\s*%/);
  return m ? "-" + m[1] + "%" : null;
}
function lowStock(product: Product) {
  return product.availableStock !== null && product.availableStock > 0 && product.availableStock <= 20;
}
function tabClass(active: boolean) {
  return [
    "shrink-0 border-b-2 px-3.5 py-2.5 text-sm transition-colors",
    active ? "border-brand font-semibold text-brand" : "border-transparent text-muted-foreground hover:text-foreground",
  ];
}
function sortClass(active: boolean) {
  return [
    "rounded-md px-2.5 py-1 font-medium transition-colors",
    active ? "bg-background text-brand shadow-sm" : "text-muted-foreground hover:text-foreground",
  ];
}
function stockLabel(product: Product) {
  if (product.availableStock === null) return messages.value.storefront.stockAvailable;
  return product.availableStock > 0
    ? t(messages.value.storefront.stockCount, { count: product.availableStock })
    : messages.value.storefront.outOfStock;
}
function stockClass(product: Product) {
  return product.availableStock === 0 ? "font-medium text-red-500" : "text-muted-foreground";
}

/* ---------- timers ---------- */
let tickTimer: ReturnType<typeof setInterval> | null = null;
let bannerTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
  bannerTimer = setInterval(() => {
    if (!paused.value && bannerSlides.value.length > 1) nextBanner(1);
  }, 5700);
});
onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
  if (bannerTimer) clearInterval(bannerTimer);
});
</script>
