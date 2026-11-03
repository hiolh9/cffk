<template>
  <main class="page-bg flex min-h-screen flex-col bg-[#eef1f7] text-foreground dark:bg-background">
    <!-- Slim top bar: site notice -->
    <div v-if="site.notice" class="border-b border-border bg-background">
      <div class="mx-auto flex max-w-[1280px] items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
        <MegaphoneIcon class="size-3.5 shrink-0 text-brand" />
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

    <!-- Main nav -->
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

    <!-- Hero cover -->
    <section v-if="!isFiltering && (bannerSlides.length || dealProducts.length)" class="relative overflow-hidden">
      <div
        v-if="currentBanner"
        class="pointer-events-none absolute inset-0 [-webkit-mask-image:linear-gradient(to_bottom,black_45%,transparent)] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
      >
        <img :key="currentBanner.id" :src="currentBanner.image" alt="" class="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-3xl saturate-150 transition-opacity duration-500" />
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

        <!-- Flash deals -->
        <div v-if="dealProducts.length" class="mt-4 overflow-hidden rounded-xl bg-card shadow-[0_16px_36px_-16px_rgba(220,38,38,0.5)] ring-1 ring-red-500/25">
          <div class="relative flex items-center justify-between gap-3 overflow-hidden bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-3 py-2.5 text-white sm:px-4">
            <span class="deal-shine pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-white/25" />
            <div class="relative flex min-w-0 items-center gap-2">
              <ZapIcon class="deal-bolt size-6 shrink-0 fill-yellow-300 text-yellow-300 drop-shadow" />
              <div class="min-w-0">
                <h2 class="m-0 text-lg font-black uppercase italic leading-none tracking-wide sm:text-xl">{{ L("flashDeals", "Flash Deals") }}</h2>
                <p class="m-0 mt-1 hidden truncate text-[11px] text-white/85 sm:block">{{ L("flashDealsSub", "Limited time only!") }}</p>
              </div>
            </div>
            <div class="relative flex shrink-0 items-center gap-1.5 text-xs">
              <span class="hidden text-white/90 sm:inline">{{ L("endsIn", "Ends in") }}</span>
              <div class="flex items-center gap-0.5 font-mono text-[13px] font-extrabold tabular-nums">
                <span class="rounded bg-white px-1.5 py-0.5 text-red-600 shadow-sm">{{ flashCountdown.h }}</span>
                <span>:</span>
                <span class="rounded bg-white px-1.5 py-0.5 text-red-600 shadow-sm">{{ flashCountdown.m }}</span>
                <span>:</span>
                <span class="rounded bg-white px-1.5 py-0.5 text-red-600 shadow-sm">{{ flashCountdown.s }}</span>
              </div>
            </div>
          </div>

          <ul class="m-0 flex list-none gap-3 overflow-x-auto bg-gradient-to-b from-red-50/70 to-card p-3 [scrollbar-width:none] dark:from-red-500/10 [&::-webkit-scrollbar]:hidden">
            <li v-for="p in dealProducts" :key="'d' + p.id" class="w-[136px] shrink-0 sm:w-[160px]">
              <a
                :href="'/product/' + p.slug"
                class="hue-card group flex h-full flex-col rounded-xl p-2 ring-1 ring-black/5 transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-red-500/30 dark:ring-white/10"
                :style="hueStyle(p.coverImage)"
              >
                <div class="relative aspect-square overflow-hidden rounded-lg bg-white/60 dark:bg-black/20">
                  <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                  <span v-if="dealBadge(p)" class="absolute left-0 top-2 rounded-r bg-gradient-to-r from-red-600 to-orange-500 py-0.5 pl-1.5 pr-2 text-[12px] font-black text-white shadow">{{ dealBadge(p) }}</span>
                </div>
                <h3 class="mt-2 line-clamp-1 text-[13px] font-medium">{{ p.name }}</h3>
                <p class="m-0 mt-0.5 text-lg font-black tabular-nums leading-tight text-red-600"><span class="mr-px text-[11px] font-bold">RM</span>{{ p.price }}</p>
                <div class="mt-1.5 h-7">
                  <template v-if="lowStock(p)">
                    <div class="h-1.5 overflow-hidden rounded-full bg-red-500/15">
                      <div class="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500" :style="{ width: Math.max(10, ((p.availableStock ?? 0) / 20) * 100) + '%' }" />
                    </div>
                    <p class="m-0 mt-0.5 flex items-center gap-0.5 text-[10px] font-bold text-red-500">
                      <FlameIcon class="size-3" />{{ t(L("itemsLeft", "{count} left"), { count: p.availableStock }) }}
                    </p>
                  </template>
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

      <!-- Featured columns: one per category, each row tinted with the icon's dominant colour -->
      <section v-if="!isFiltering && featuredColumns.length" class="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        <div v-for="col in featuredColumns" :key="'col' + col.id" class="surface w-[86%] shrink-0 snap-start rounded-xl bg-card p-3 ring-1 ring-black/[0.04] md:w-auto dark:ring-white/10">
          <div class="mb-1 flex items-center justify-between gap-2">
            <h3 class="flex items-center gap-2 text-[15px] font-bold">
              <span class="h-4 w-1 rounded-full bg-brand" />
              <span class="line-clamp-1">{{ col.title }}</span>
            </h3>
            <button v-if="col.id !== null" type="button" class="flex shrink-0 items-center text-xs text-brand hover:underline" @click="openCategory(col.id)">
              {{ L("viewAll", "View all") }}<ChevronRightIcon class="size-3.5" />
            </button>
          </div>
          <ul class="m-0 list-none space-y-1.5 p-0">
            <li v-for="p in col.products" :key="'c' + p.id">
              <a :href="'/product/' + p.slug" class="hue-row group flex items-center gap-3 rounded-xl p-2 transition hover:brightness-[0.98]" :style="hueStyle(p.coverImage)">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-[52px] shrink-0 rounded-xl bg-white/60 object-cover shadow-sm dark:bg-black/20" loading="lazy" width="52" height="52" />
                <div class="min-w-0 flex-1">
                  <h4 class="line-clamp-1 text-[13px] font-medium group-hover:text-brand">{{ p.name }}</h4>
                  <p class="m-0 mt-1 flex items-center gap-2 text-xs">
                    <span class="font-bold tabular-nums"><span class="mr-px text-[10px] font-semibold text-muted-foreground">RM</span>{{ p.price }}</span>
                    <span :class="stockClass(p)">{{ stockLabel(p) }}</span>
                  </p>
                </div>
                <span v-if="dealBadge(p)" class="shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{{ dealBadge(p) }}</span>
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

        <div v-if="sortedProducts.length" class="rounded-2xl bg-white/55 p-2.5 ring-1 ring-white/70 sm:p-3 dark:bg-white/[0.04] dark:ring-white/10">
          <ul class="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <li v-for="p in sortedProducts" :key="p.id">
              <a
                :href="'/product/' + p.slug"
                class="hue-row surface group flex h-full items-center gap-3 rounded-xl p-2.5 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-brand/30 dark:ring-white/10"
                :style="hueStyle(p.coverImage)"
              >
                <div class="relative size-[76px] shrink-0 overflow-hidden rounded-xl bg-white/60 shadow-sm sm:size-[88px] dark:bg-black/20">
                  <img
                    :src="p.coverImage || defaultProductImage"
                    :alt="p.name"
                    class="size-full object-cover transition duration-300 group-hover:scale-105"
                    :class="p.availableStock === 0 ? 'opacity-50 grayscale' : ''"
                    loading="lazy"
                  />
                </div>
                <div class="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
                  <div>
                    <h3 class="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-brand sm:text-sm">{{ p.name }}</h3>
                    <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{{ p.subtitle }}</p>
                  </div>
                  <div class="mt-1.5 flex items-end justify-between gap-2">
                    <div class="flex items-center gap-1.5">
                      <p class="m-0 text-base font-bold tabular-nums leading-none"><span class="mr-px text-[11px] font-semibold text-muted-foreground">RM</span>{{ p.price }}</p>
                      <span v-if="dealBadge(p)" class="rounded bg-gradient-to-r from-red-600 to-orange-500 px-1.5 py-0.5 text-[11px] font-black leading-none text-white">{{ dealBadge(p) }}</span>
                    </div>
                    <span class="shrink-0 text-[11px] leading-none" :class="stockClass(p)">{{ stockLabel(p) }}</span>
                  </div>
                </div>
              </a>
            </li>
          </ul>
        </div>
        <p v-else class="rounded-xl bg-card py-16 text-center text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
      </section>
    </div>

    <StorefrontFooter />
  </main>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ChevronLeftIcon, ChevronRightIcon, FlameIcon, MegaphoneIcon, SearchIcon, ZapIcon } from "@lucide/vue";
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
          if (px[i + 3] < 128) continue; // transparent
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

function hueStyle(src: string | null | undefined) {
  const h = hues[src || defaultProductImage];
  return h ? { "--hue": h } : undefined;
}

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

/* ---------- lifecycle ---------- */
const imgOf = (p: Product) => p.coverImage || defaultProductImage;

let tickTimer: ReturnType<typeof setInterval> | null = null;
let bannerTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
  bannerTimer = setInterval(() => {
    if (!paused.value && bannerSlides.value.length > 1) nextBanner(1);
  }, 5700);

  // sample colours for what is on screen first, then the product grid
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
/* Tint from the image's dominant colour (--hue, set from JS) fading into the surface colour.
   Only applies once --hue exists, so un-sampled items keep the plain card background. */
.hue-row,
.hue-card {
  --hue-base: #ffffff;
}
.dark .hue-row,
.dark .hue-card {
  --hue-base: #171b26;
}
.hue-row[style*="--hue"] {
  background-image: linear-gradient(100deg, color-mix(in srgb, var(--hue) 26%, var(--hue-base)), var(--hue-base) 72%);
}
.hue-card[style*="--hue"] {
  background-image: linear-gradient(180deg, color-mix(in srgb, var(--hue) 24%, var(--hue-base)), var(--hue-base) 64%);
}
.hue-card:not([style*="--hue"]) {
  background-color: var(--hue-base);
}

/* Layered page background: soft colour glows + faint dot texture */
.page-bg {
  --glow-a: rgba(0, 136, 238, 0.16);
  --glow-b: rgba(255, 110, 64, 0.11);
  --glow-c: rgba(0, 62, 170, 0.08);
  --dot: rgba(15, 23, 42, 0.06);
  background-image:
    radial-gradient(900px 460px at 8% -4%, var(--glow-a), transparent 70%),
    radial-gradient(760px 420px at 96% 12%, var(--glow-b), transparent 70%),
    radial-gradient(1100px 620px at 50% 102%, var(--glow-c), transparent 70%),
    radial-gradient(var(--dot) 1px, transparent 1px);
  background-size: auto, auto, auto, 22px 22px;
  background-repeat: no-repeat, no-repeat, no-repeat, repeat;
}
.dark .page-bg {
  --glow-a: rgba(0, 136, 238, 0.18);
  --glow-b: rgba(255, 110, 64, 0.08);
  --glow-c: rgba(0, 62, 170, 0.14);
  --dot: rgba(255, 255, 255, 0.045);
}
/* Raised surface: tight contact shadow + wide soft shadow */
.surface {
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 14px 30px -18px rgba(16, 24, 40, 0.28);
}
.dark .surface {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 14px 30px -18px rgba(0, 0, 0, 0.7);
}

/* Flash-deal motion */
@keyframes deal-shine {
  0% { transform: translateX(-160%) skewX(-20deg); }
  55%, 100% { transform: translateX(700%) skewX(-20deg); }
}
@keyframes deal-bolt {
  0%, 100% { opacity: 1; }
  45% { opacity: 0.5; }
  50% { opacity: 1; }
  58% { opacity: 0.6; }
}
.deal-shine { animation: deal-shine 3.4s ease-in-out infinite; }
.deal-bolt { animation: deal-bolt 1.8s steps(1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .deal-shine,
  .deal-bolt { animation: none; }
}
</style>
