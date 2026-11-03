<template>
  <main class="flex min-h-screen flex-col bg-[#f5f6f8] text-foreground dark:bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-border bg-background">
      <div class="mx-auto flex h-12 max-w-[1280px] items-center justify-between gap-3 px-3 sm:h-14">
        <StorefrontBrand />
        <div class="relative hidden min-w-0 flex-1 md:block md:max-w-lg">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            type="search"
            class="h-9 rounded-md border-border bg-muted/60 pl-9 text-sm shadow-none focus-visible:border-brand focus-visible:ring-0"
            :placeholder="messages.storefront.searchProducts"
          />
        </div>
        <PublicNav />
      </div>
    </header>

    <!-- Notice -->
    <div v-if="site.notice" class="border-b border-border bg-background">
      <div class="mx-auto flex max-w-[1280px] items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground">
        <MegaphoneIcon class="size-3.5 shrink-0 text-brand" />
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

    <div class="mx-auto w-full max-w-[1280px] flex-1 space-y-3 px-3 pt-3">
      <!-- Mobile search -->
      <div class="relative md:hidden">
        <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="query"
          type="search"
          class="h-10 rounded-md border-border bg-background pl-9 text-sm shadow-none focus-visible:border-brand focus-visible:ring-0"
          :placeholder="messages.storefront.searchProducts"
        />
      </div>

      <!-- Banner + promo tiles -->
      <div v-if="bannerSlides.length" class="grid gap-3 lg:grid-cols-[1fr_280px]">
        <section class="group relative overflow-hidden rounded-lg bg-muted">
          <div class="flex transition-transform duration-500 ease-out" :style="{ transform: 'translateX(-' + bannerIndex * 100 + '%)' }">
            <a
              v-for="slide in bannerSlides"
              :key="slide.id"
              :href="slide.href"
              class="relative block h-40 w-full shrink-0 sm:h-56 lg:h-[260px]"
            >
              <img :src="slide.image" :alt="slide.title" class="size-full object-cover" loading="lazy" />
              <div v-if="slide.title" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-6 pt-12">
                <h2 class="line-clamp-1 text-base font-semibold text-white sm:text-xl">{{ slide.title }}</h2>
                <p v-if="slide.subtitle" class="mt-0.5 line-clamp-1 text-xs text-white/80 sm:text-sm">{{ slide.subtitle }}</p>
              </div>
            </a>
          </div>
          <template v-if="bannerSlides.length > 1">
            <button type="button" class="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55 sm:flex" aria-label="Prev" @click.prevent="nextBanner(-1)">
              <ChevronLeftIcon class="size-4" />
            </button>
            <button type="button" class="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55 sm:flex" aria-label="Next" @click.prevent="nextBanner(1)">
              <ChevronRightIcon class="size-4" />
            </button>
            <div class="absolute bottom-2.5 right-3 flex gap-1">
              <button
                v-for="(_, i) in bannerSlides"
                :key="i"
                type="button"
                class="h-1.5 rounded-full transition-all"
                :class="i === bannerIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'"
                @click.prevent="bannerIndex = i"
              />
            </div>
          </template>
        </section>

        <div v-if="promoTiles.length" class="hidden grid-rows-2 gap-3 lg:grid">
          <a v-for="p in promoTiles" :key="'promo' + p.id" :href="'/product/' + p.slug" class="relative block overflow-hidden rounded-lg bg-muted">
            <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-full object-cover" loading="lazy" />
            <div class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-10">
              <span class="line-clamp-1 text-sm font-medium text-white">{{ p.name }}</span>
              <span class="shrink-0 text-sm font-bold tabular-nums text-white">RM{{ p.price }}</span>
            </div>
          </a>
        </div>
      </div>

      <!-- Categories -->
      <nav v-if="data.categories.length" class="rounded-lg bg-card px-3 py-2.5">
        <div class="flex flex-wrap gap-2">
          <button type="button" :class="chipClass(selectedCategory === null)" @click="selectedCategory = null">{{ messages.storefront.all }}</button>
          <button v-for="c in data.categories" :key="c.id" type="button" :class="chipClass(selectedCategory === c.id)" @click="selectedCategory = c.id">
            {{ c.name }}
          </button>
        </div>
      </nav>

      <!-- Flash deals -->
      <section v-if="flashProducts.length" class="overflow-hidden rounded-lg bg-card">
        <div class="flex items-center justify-between gap-2 px-3 py-2.5">
          <h2 class="flex items-center gap-1.5 text-[15px] font-semibold">
            <ZapIcon class="size-4 fill-red-600 text-red-600" />
            {{ L("flashDeals", "Flash Deals") }}
          </h2>
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{{ L("endsIn", "Ends in") }}</span>
            <div class="flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums">
              <span class="rounded bg-red-600 px-1.5 py-0.5 text-white">{{ flashCountdown.h }}</span><span class="text-red-600">:</span>
              <span class="rounded bg-red-600 px-1.5 py-0.5 text-white">{{ flashCountdown.m }}</span><span class="text-red-600">:</span>
              <span class="rounded bg-red-600 px-1.5 py-0.5 text-white">{{ flashCountdown.s }}</span>
            </div>
          </div>
        </div>
        <ul class="m-0 flex snap-x list-none gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <li v-for="p in flashProducts" :key="'f' + p.id" class="w-[132px] shrink-0 snap-start sm:w-[160px]">
            <a :href="'/product/' + p.slug" class="group block">
              <div class="relative aspect-square overflow-hidden rounded-md bg-muted">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                <span v-if="dealBadge(p)" class="absolute left-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">{{ dealBadge(p) }}</span>
              </div>
              <p class="mt-1.5 text-base font-bold tabular-nums text-red-600"><span class="mr-px text-[11px] font-semibold">RM</span>{{ p.price }}</p>
              <p v-if="lowStock(p)" class="mt-0.5 text-[11px] text-muted-foreground">{{ t(L("itemsLeft", "{count} left"), { count: p.availableStock }) }}</p>
            </a>
          </li>
        </ul>
      </section>

      <!-- Hot products -->
      <section v-if="hotProducts.length" class="overflow-hidden rounded-lg bg-card">
        <h2 class="flex items-center gap-1.5 px-3 py-2.5 text-[15px] font-semibold">
          <FlameIcon class="size-4 text-brand" />
          {{ L("hotProducts", "Hot Products") }}
        </h2>
        <ol class="m-0 grid list-none gap-x-6 px-3 pb-1 md:grid-cols-2 xl:grid-cols-3">
          <li v-for="(p, i) in hotProducts" :key="'h' + p.id" class="border-t border-border">
            <a :href="'/product/' + p.slug" class="group flex items-center gap-3 py-2.5">
              <span class="w-4 shrink-0 text-center text-sm font-bold tabular-nums" :class="i < 3 ? 'text-brand' : 'text-muted-foreground/60'">{{ i + 1 }}</span>
              <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-14 shrink-0 rounded-md bg-muted object-cover" loading="lazy" width="56" height="56" />
              <div class="min-w-0 flex-1">
                <h3 class="line-clamp-2 text-[13px] leading-snug group-hover:text-brand">{{ p.name }}</h3>
                <p class="mt-1 text-sm font-bold tabular-nums text-red-600"><span class="mr-px text-[11px] font-semibold">RM</span>{{ p.price }}</p>
              </div>
            </a>
          </li>
        </ol>
      </section>

      <!-- All products -->
      <section class="pb-8">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-baseline gap-2">
            <h2 class="shrink-0 text-[15px] font-semibold">{{ messages.storefront.products }}</h2>
            <span class="truncate text-xs text-muted-foreground">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-3 text-[13px]">
            <button v-for="s in sortOptions" :key="s.key" type="button" :class="sortClass(sort === s.key)" @click="sort = s.key">
              {{ L(s.labelKey, s.fallback) }}
            </button>
          </div>
        </div>

        <ul v-if="sortedProducts.length" class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <li v-for="p in sortedProducts" :key="p.id">
            <a :href="'/product/' + p.slug" class="group flex h-full flex-col overflow-hidden rounded-lg bg-card transition hover:shadow-md">
              <div class="relative aspect-square overflow-hidden bg-muted">
                <img
                  :src="p.coverImage || defaultProductImage"
                  :alt="p.name"
                  class="size-full object-cover transition duration-300 group-hover:scale-105"
                  :class="p.availableStock === 0 ? 'opacity-50' : ''"
                  loading="lazy"
                />
                <span v-if="dealBadge(p)" class="absolute left-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">{{ dealBadge(p) }}</span>
              </div>
              <div class="flex flex-1 flex-col p-2.5">
                <h3 class="line-clamp-2 text-[13px] leading-snug group-hover:text-brand">{{ p.name }}</h3>
                <p v-if="p.subtitle" class="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{{ p.subtitle }}</p>
                <div class="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 pt-2">
                  <p class="m-0 text-base font-bold tabular-nums text-red-600"><span class="mr-px text-[11px] font-semibold">RM</span>{{ p.price }}</p>
                  <span class="text-[11px]" :class="stockClass(p)">{{ stockLabel(p) }}</span>
                </div>
              </div>
            </a>
          </li>
        </ul>
        <p v-else class="rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
      </section>
    </div>

    <StorefrontFooter />
  </main>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
 * i18n: reads messages.storefront[key] and falls back to English if the key
 * isn't in your message files yet. Add these keys to every locale:
 *   flashDeals, hotProducts, endsIn, itemsLeft ("{count} left"),
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

const promoTiles = computed(() => data.products.filter((p) => p.coverImage).slice(5, 7));

const flashProducts = computed(() => visibleProducts.value.slice(0, 10));
const hotProducts = computed(() => {
  const rest = visibleProducts.value.slice(10, 16);
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
function lowStock(product: Product) {
  return product.availableStock !== null && product.availableStock > 0 && product.availableStock <= 20;
}
function nextBanner(dir: number) {
  const n = bannerSlides.value.length;
  if (n) bannerIndex.value = (bannerIndex.value + dir + n) % n;
}
function chipClass(active: boolean) {
  return [
    "rounded-full px-3.5 py-1 text-[13px] transition-colors",
    active ? "bg-brand font-medium text-white" : "bg-muted text-foreground/75 hover:text-brand",
  ];
}
function sortClass(active: boolean) {
  return active ? "font-semibold text-brand" : "text-muted-foreground hover:text-foreground";
}
function stockLabel(product: Product) {
  if (product.availableStock === null) return messages.value.storefront.stockAvailable;
  return product.availableStock > 0
    ? t(messages.value.storefront.stockCount, { count: product.availableStock })
    : messages.value.storefront.outOfStock;
}
function stockClass(product: Product) {
  return product.availableStock === 0 ? "font-medium text-red-600" : "text-muted-foreground";
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
