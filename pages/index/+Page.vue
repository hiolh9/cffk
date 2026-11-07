<template>
  <main class="page-bg flex min-h-screen flex-col text-foreground">
    <!-- Site notice -->
    <div v-if="site.notice" class="border-b border-border bg-background">
      <div class="mx-auto flex max-w-[1280px] items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
        <MegaphoneIcon class="size-3.5 shrink-0 text-brand" />
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

    <!-- Header: brand, search, account. Categories sit in a sticky chip row. -->
    <header class="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-3">
        <StorefrontBrand />
        <div class="relative hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-xl">
          <SearchIcon class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            type="search"
            class="h-10 rounded-full border-transparent bg-muted pl-10 text-sm shadow-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
            :placeholder="L('searchGames', messages.storefront.searchProducts)"
            :aria-label="messages.storefront.searchProducts"
          />
        </div>
        <PublicNav />
      </div>
      <nav v-if="data.categories.length" class="mx-auto max-w-[1280px]" :aria-label="L('categories', 'Categories')">
        <div class="flex gap-2 overflow-x-auto px-3 pb-2.5 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" :class="chipClass(selectedCategory === null)" :aria-pressed="selectedCategory === null" @click="selectedCategory = null">
            {{ messages.storefront.all }}
          </button>
          <button
            v-for="c in data.categories"
            :key="c.id"
            type="button"
            :class="chipClass(selectedCategory === c.id)"
            :aria-pressed="selectedCategory === c.id"
            @click="selectedCategory = c.id"
          >
            {{ c.name }}
          </button>
        </div>
      </nav>
    </header>

    <!-- Hero banners -->
    <section v-if="!isFiltering && bannerSlides.length" class="hero-band relative overflow-hidden" :aria-label="L('featured', 'Featured')">
      <div class="relative mx-auto max-w-[1280px] px-3 pb-3 pt-3 sm:pt-5">
        <div class="group relative -mx-3" @mouseenter="paused = true" @mouseleave="paused = false" @focusin="paused = true" @focusout="paused = false">
          <div
            ref="slidesEl"
            class="relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[7%] sm:px-[11%] lg:px-[calc(50%-500px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            @scroll.passive="onBannerScroll"
          >
            <a
              v-for="(slide, i) in bannerSlides"
              :key="slide.id"
              :href="slide.href"
              class="relative h-40 w-[86%] shrink-0 snap-center overflow-hidden rounded-2xl bg-muted shadow-sm outline-none transition-opacity duration-300 focus-visible:ring-2 focus-visible:ring-brand sm:h-44 sm:w-[78%] lg:h-[200px] lg:w-[1000px]"
              :class="i === bannerIndex ? 'opacity-100' : 'opacity-50'"
              :tabindex="i === bannerIndex ? 0 : -1"
            >
              <img :src="slide.image" :alt="slide.title" class="size-full object-cover" :loading="i === 0 ? 'eager' : 'lazy'" />
              <div v-if="slide.title" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-14">
                <h2 class="line-clamp-1 text-base font-bold text-white sm:text-xl">{{ slide.title }}</h2>
                <p v-if="slide.subtitle" class="mt-0.5 line-clamp-1 text-xs text-white/80 sm:text-sm">{{ slide.subtitle }}</p>
              </div>
            </a>
          </div>
          <template v-if="bannerSlides.length > 1">
            <button type="button" class="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow transition hover:bg-background focus-visible:ring-2 focus-visible:ring-brand sm:flex lg:left-[calc(50%-540px)]" aria-label="Previous banner" @click.prevent="nextBanner(-1)">
              <ChevronLeftIcon class="size-5" />
            </button>
            <button type="button" class="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow transition hover:bg-background focus-visible:ring-2 focus-visible:ring-brand sm:flex lg:right-[calc(50%-540px)]" aria-label="Next banner" @click.prevent="nextBanner(1)">
              <ChevronRightIcon class="size-5" />
            </button>
            <div class="mt-3 flex justify-center gap-1.5">
              <button
                v-for="(_, i) in bannerSlides"
                :key="i"
                type="button"
                class="h-1.5 rounded-full transition-all"
                :class="i === bannerIndex ? 'w-5 bg-brand' : 'w-1.5 bg-foreground/25'"
                :aria-label="'Banner ' + (i + 1)"
                :aria-current="i === bannerIndex"
                @click.prevent="goTo(i)"
              />
            </div>
          </template>
        </div>
      </div>
    </section>

    <div class="mx-auto w-full max-w-[1280px] flex-1 space-y-8 px-3 pb-10 pt-5">
      <!-- Mobile search -->
      <div class="relative md:hidden">
        <SearchIcon class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="query"
          type="search"
          class="h-11 rounded-full border-border bg-background pl-10 text-sm shadow-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
          :placeholder="L('searchGames', messages.storefront.searchProducts)"
          :aria-label="messages.storefront.searchProducts"
        />
      </div>

      <!-- Flash deals: title left, countdown and link right, horizontal cards below -->
      <section v-if="!isFiltering && dealProducts.length" aria-labelledby="flash-title">
        <div class="mb-3 flex items-end justify-between gap-3">
          <div class="min-w-0">
            <h2 id="flash-title" class="m-0 text-xl font-bold leading-tight">{{ L("flashDeals", "Flash deals") }}</h2>
            <p class="m-0 mt-0.5 truncate text-xs text-muted-foreground">{{ L("flashDealsSub", "Limited time only") }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <div class="flex items-center gap-1.5 text-xs text-muted-foreground" role="timer" :aria-label="L('endsIn', 'Ends in')">
              <span class="hidden sm:inline">{{ L("endsIn", "Ends in") }}</span>
              <div class="flex items-center gap-0.5 font-mono text-[13px] font-bold tabular-nums">
                <span class="rounded-md bg-red-600 px-1.5 py-0.5 text-white">{{ flashCountdown.h }}</span>
                <span class="text-red-600">:</span>
                <span class="rounded-md bg-red-600 px-1.5 py-0.5 text-white">{{ flashCountdown.m }}</span>
                <span class="text-red-600">:</span>
                <span class="rounded-md bg-red-600 px-1.5 py-0.5 text-white">{{ flashCountdown.s }}</span>
              </div>
            </div>
            <a href="#all-products" class="hidden h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand sm:inline-flex">
              {{ L("viewAll", "View all") }}<ChevronRightIcon class="size-4" />
            </a>
          </div>
        </div>
        <ul class="m-0 flex list-none snap-x gap-3 overflow-x-auto p-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <li v-for="p in dealProducts" :key="'d' + p.id" class="w-[250px] shrink-0 snap-start sm:w-[272px] lg:w-[calc((100%-48px)/5)]">
            <DealCard v-bind="tileProps(p)" />
          </li>
        </ul>
      </section>

      <!-- Popular by category: two panels per row, items laid out horizontally -->
      <div v-if="shownColumns.length" class="grid gap-3 md:grid-cols-2">
        <section v-for="col in shownColumns" :key="'col' + col.id" class="surface rounded-2xl bg-card p-4 ring-1 ring-black/[0.04] dark:ring-white/10">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h2 class="m-0 line-clamp-1 text-base font-bold">{{ col.title }}</h2>
            <button v-if="col.id !== null" type="button" class="flex shrink-0 items-center rounded-md text-xs font-medium text-muted-foreground transition hover:text-brand focus-visible:ring-2 focus-visible:ring-brand" @click="openCategory(col.id)">
              {{ L("viewAll", "View all") }}<ChevronRightIcon class="size-3.5" />
            </button>
          </div>
          <ul class="m-0 grid list-none grid-cols-2 gap-x-2 gap-y-1 p-0 lg:grid-cols-3">
            <li v-for="p in col.products" :key="'c' + p.id">
              <ProductRow v-bind="tileProps(p)" compact />
            </li>
          </ul>
        </section>
      </div>

      <!-- All products / search results: horizontal rows -->
      <section id="all-products" class="scroll-mt-28">
        <div class="mb-3 flex items-end justify-between gap-3">
          <div class="min-w-0">
            <h2 class="m-0 text-xl font-bold leading-tight">{{ currentTitle }}</h2>
            <p class="m-0 mt-0.5 truncate text-xs text-muted-foreground">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</p>
          </div>
          <div class="flex shrink-0 rounded-lg bg-muted p-0.5 text-xs" role="group" :aria-label="L('sortBy', 'Sort by')">
            <button v-for="s in sortOptions" :key="s.key" type="button" :class="sortClass(sort === s.key)" :aria-pressed="sort === s.key" @click="sort = s.key">
              {{ L(s.labelKey, s.fallback) }}
            </button>
          </div>
        </div>

        <ul v-if="sortedProducts.length" class="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <li v-for="p in sortedProducts" :key="p.id">
            <ProductRow v-bind="tileProps(p)" />
          </li>
        </ul>

        <div v-else class="rounded-2xl bg-card px-4 py-14 text-center ring-1 ring-black/[0.05] dark:ring-white/10">
          <p class="m-0 text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
          <button v-if="isFiltering" type="button" class="mt-3 inline-flex items-center gap-1 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2" @click="clearFilters">
            <XIcon class="size-4" />{{ L("clearFilters", "Clear search and filters") }}
          </button>
        </div>
      </section>
    </div>

    <StorefrontFooter />
  </main>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ChevronLeftIcon, ChevronRightIcon, MegaphoneIcon, SearchIcon, XIcon } from "@lucide/vue";
import { useData } from "vike-vue/useData";
import { usePageContext } from "vike-vue/usePageContext";
import PublicNav from "@/components/storefront/PublicNav.vue";
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";
import ProductRow from "@/components/storefront/ProductRow.vue";
import DealCard from "@/components/storefront/DealCard.vue";
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
 *   hotProducts, sortPopular, sortPriceAsc, sortPriceDesc, sortBy, searchGames,
 *   categories, featured, clearFilters, searchResults, allGames
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

/* ---------- dominant colour of each cover image (computed in the browser) ---------- */
// image url -> "#rrggbb", or "" when it could not be read (CORS / load error / blank image)
const hues = reactive<Record<string, string>>({});

function sampleHue(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // the image host must send CORS headers, otherwise we fall back silently
    img.decoding = "async";
    img.onload = () => {
      try {
        const S = 24;
        const canvas = document.createElement("canvas");
        canvas.width = S;
        canvas.height = S;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve("");
        ctx.drawImage(img, 0, 0, S, S);
        const px = ctx.getImageData(0, 0, S, S).data;
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 128) continue;
          const R = px[i], G = px[i + 1], B = px[i + 2];
          const max = Math.max(R, G, B);
          const min = Math.min(R, G, B);
          if (max > 245 && min > 235) continue; // white background
          if (max < 20) continue; // near black
          const sat = (max - min) / max;
          const weight = sat * sat + 0.03; // favour vivid pixels over grey ones
          r += R * weight;
          g += G * weight;
          b += B * weight;
          w += weight;
        }
        if (!w) return resolve("");
        resolve("#" + [r, g, b].map((v) => Math.round(v / w).toString(16).padStart(2, "0")).join(""));
      } catch {
        resolve(""); // tainted canvas
      }
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

async function ensureHues(urls: string[]) {
  const todo = [...new Set(urls)].filter((u) => !(u in hues));
  todo.forEach((u) => (hues[u] = "")); // mark as in-flight so we never sample twice
  for (let i = 0; i < todo.length; i += 4) {
    const chunk = todo.slice(i, i + 4);
    const results = await Promise.all(chunk.map(sampleHue));
    chunk.forEach((u, j) => (hues[u] = results[j]));
  }
}

const imgOf = (p: Product) => p.coverImage || defaultProductImage;

/* ---------- products ---------- */
const isFiltering = computed(() => query.value.trim() !== "" || selectedCategory.value !== null);

const currentTitle = computed(() => {
  if (selectedCategory.value !== null) {
    return data.categories.find((c) => c.id === selectedCategory.value)?.name ?? messages.value.storefront.products;
  }
  return query.value.trim() ? L("searchResults", "Search results") : L("allGames", messages.value.storefront.products);
});

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
  return data.products.length ? [{ id: null, title: L("hotProducts", "Hot products"), products: data.products.slice(0, 6) }] : [];
});

const shownColumns = computed(() => (isFiltering.value ? [] : featuredColumns.value));

function openCategory(id: number) {
  selectedCategory.value = id;
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearFilters() {
  query.value = "";
  selectedCategory.value = null;
}

/* ---------- card props ---------- */
function dealBadge(product: Product) {
  const m = product.subtitle?.match(/(\d+)\s*%/);
  return m ? "-" + m[1] + "%" : null;
}
function lowStock(product: Product) {
  return product.availableStock !== null && product.availableStock > 0 && product.availableStock <= 20;
}
function stockLabel(product: Product) {
  if (product.availableStock === null) return messages.value.storefront.stockAvailable;
  return product.availableStock > 0
    ? t(messages.value.storefront.stockCount, { count: product.availableStock })
    : messages.value.storefront.outOfStock;
}
function tileProps(p: Product) {
  const img = imgOf(p);
  return {
    href: "/product/" + p.slug,
    name: p.name,
    subtitle: p.subtitle,
    image: img,
    price: p.price,
    badge: dealBadge(p),
    soldOut: p.availableStock === 0,
    stock: p.availableStock ?? 0,
    lowStock: lowStock(p),
    lowStockLabel: t(L("itemsLeft", "{count} left"), { count: p.availableStock }),
    stockLabel: stockLabel(p),
    hue: hues[img] || undefined,
  };
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

/* ---------- countdown (to local midnight) ---------- */
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

/* ---------- class helpers ---------- */
function chipClass(active: boolean) {
  return [
    "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
    active ? "bg-brand text-white shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground",
  ];
}
function sortClass(active: boolean) {
  return [
    "rounded-md px-2.5 py-1 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
    active ? "bg-background text-brand shadow-sm" : "text-muted-foreground hover:text-foreground",
  ];
}

/* ---------- lifecycle ---------- */
let tickTimer: ReturnType<typeof setInterval> | null = null;
let bannerTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
  if (!reduceMotion) {
    bannerTimer = setInterval(() => {
      if (!paused.value && bannerSlides.value.length > 1) nextBanner(1);
    }, 5700);
  }

  // sample colours for what is on screen first, then the full list
  ensureHues([
    ...dealProducts.value.map(imgOf),
    ...featuredColumns.value.flatMap((c) => c.products.map(imgOf)),
  ]);
  ensureHues(sortedProducts.value.slice(0, 48).map(imgOf));
  watch(
    () => sortedProducts.value.slice(0, 48).map(imgOf),
    (urls) => ensureHues(urls),
  );
});
onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
  if (bannerTimer) clearInterval(bannerTimer);
});
</script>

<style>
/* Page texture: soft dots only */
.page-bg {
  --paper: #f1f3f8;
  background-color: var(--paper);
  background-image: radial-gradient(rgba(15, 23, 42, 0.045) 1px, transparent 1px);
  background-size: 14px 14px;
}
.dark .page-bg {
  --paper: #10131b;
  background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
}
/* Clear split under the banner */
.hero-band {
  background: linear-gradient(180deg, #e8ecf3 0%, #eef1f6 100%);
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  box-shadow: 0 8px 20px -16px rgba(15, 23, 42, 0.35);
}
.dark .hero-band {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
  border-bottom-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
}
/* Raised surface */
.surface {
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 14px 30px -18px rgba(16, 24, 40, 0.28);
}
.dark .surface {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 14px 30px -18px rgba(0, 0, 0, 0.7);
}
</style>
