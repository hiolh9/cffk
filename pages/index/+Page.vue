<template>
  <main class="flex min-h-screen flex-col bg-[#f4f4f5] text-foreground dark:bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-border bg-background">
      <div class="mx-auto flex h-12 max-w-[1280px] items-center justify-between gap-3 px-2 sm:h-14 sm:px-3">
        <StorefrontBrand />
        <div class="relative hidden min-w-0 flex-1 md:block md:max-w-xl">
          <Input
            v-model="query"
            type="search"
            class="h-9 rounded-md border-2 border-brand bg-background pl-3 pr-10 text-sm shadow-none focus-visible:ring-0"
            :placeholder="messages.storefront.searchProducts"
          />
          <span class="pointer-events-none absolute right-0 top-0 flex h-9 w-10 items-center justify-center rounded-r-md bg-brand text-white">
            <SearchIcon class="size-4" />
          </span>
        </div>
        <PublicNav />
      </div>
    </header>

    <!-- Notice -->
    <div v-if="site.notice" class="bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
      <div class="mx-auto flex max-w-[1280px] items-center gap-2 px-2 py-1.5 text-xs sm:px-3 sm:text-[13px]">
        <MegaphoneIcon class="size-3.5 shrink-0" />
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

    <!-- Brand band: mobile search + banner + promo tiles -->
    <div class="bg-brand pb-3 pt-2 sm:pt-3">
      <div class="mx-auto max-w-[1280px] px-2 sm:px-3">
        <div class="relative mb-2 md:hidden">
          <Input
            v-model="query"
            type="search"
            class="h-9 rounded-md border-0 bg-white pl-3 pr-10 text-sm text-foreground shadow-none focus-visible:ring-0"
            :placeholder="messages.storefront.searchProducts"
          />
          <SearchIcon class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand" />
        </div>

        <div v-if="bannerSlides.length" class="grid gap-2 lg:grid-cols-[1fr_300px]">
          <section class="group relative overflow-hidden rounded-md bg-black/10">
            <div class="flex transition-transform duration-500 ease-out" :style="{ transform: 'translateX(-' + bannerIndex * 100 + '%)' }">
              <a
                v-for="slide in bannerSlides"
                :key="slide.id"
                :href="slide.href"
                class="relative block h-36 w-full shrink-0 sm:h-52 lg:h-[270px]"
              >
                <img :src="slide.image" :alt="slide.title" class="size-full object-cover" loading="lazy" />
                <div v-if="slide.title" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-6 pt-10 sm:px-4">
                  <h2 class="line-clamp-1 text-base font-bold text-white sm:text-xl">{{ slide.title }}</h2>
                  <p v-if="slide.subtitle" class="mt-0.5 line-clamp-1 text-xs text-white/85 sm:text-sm">{{ slide.subtitle }}</p>
                </div>
              </a>
            </div>
            <template v-if="bannerSlides.length > 1">
              <button type="button" class="absolute left-0 top-1/2 flex h-10 w-7 -translate-y-1/2 items-center justify-center rounded-r bg-black/35 text-white hover:bg-black/55" aria-label="Prev" @click.prevent="nextBanner(-1)">
                <ChevronLeftIcon class="size-4" />
              </button>
              <button type="button" class="absolute right-0 top-1/2 flex h-10 w-7 -translate-y-1/2 items-center justify-center rounded-l bg-black/35 text-white hover:bg-black/55" aria-label="Next" @click.prevent="nextBanner(1)">
                <ChevronRightIcon class="size-4" />
              </button>
              <div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                <button
                  v-for="(_, i) in bannerSlides"
                  :key="i"
                  type="button"
                  class="h-1.5 rounded-full transition-all"
                  :class="i === bannerIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/55'"
                  @click.prevent="bannerIndex = i"
                />
              </div>
            </template>
          </section>

          <div v-if="promoTiles.length" class="hidden grid-rows-2 gap-2 lg:grid">
            <a
              v-for="p in promoTiles"
              :key="'promo' + p.id"
              :href="'/product/' + p.slug"
              class="relative block overflow-hidden rounded-md bg-black/10"
            >
              <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-full object-cover" loading="lazy" />
              <div class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8">
                <span class="line-clamp-1 text-sm font-semibold text-white">{{ p.name }}</span>
                <span class="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold tabular-nums text-white">RM{{ p.price }}</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="mx-auto w-full max-w-[1280px] flex-1 space-y-2 px-2 pt-2 sm:px-3">
      <!-- Categories -->
      <section v-if="data.categories.length" class="rounded-md bg-card p-2">
        <div class="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          <button type="button" :class="catClass(selectedCategory === null)" @click="selectedCategory = null">
            <span :class="catIconClass(selectedCategory === null)"><LayoutGridIcon class="size-4" /></span>
            <span class="line-clamp-1 text-[12px] leading-tight">{{ messages.storefront.all }}</span>
          </button>
          <button v-for="c in data.categories" :key="c.id" type="button" :class="catClass(selectedCategory === c.id)" @click="selectedCategory = c.id">
            <span :class="catIconClass(selectedCategory === c.id)" class="text-sm font-bold">{{ c.name.slice(0, 1).toUpperCase() }}</span>
            <span class="line-clamp-1 w-full text-[12px] leading-tight">{{ c.name }}</span>
          </button>
        </div>
      </section>

      <!-- Flash deals -->
      <section v-if="flashProducts.length" class="overflow-hidden rounded-md bg-card">
        <div class="flex items-center justify-between gap-2 bg-red-600 px-3 py-2 text-white">
          <div class="flex items-center gap-2">
            <ZapIcon class="size-4 fill-current" />
            <h2 class="text-sm font-extrabold uppercase tracking-wide sm:text-base">Flash Deals</h2>
          </div>
          <div class="flex items-center gap-1.5 text-xs">
            <span class="hidden sm:inline">Ends in</span>
            <div class="flex items-center gap-0.5 font-mono text-xs font-bold tabular-nums">
              <span class="rounded bg-white px-1.5 py-0.5 text-red-600">{{ flashCountdown.h }}</span>:
              <span class="rounded bg-white px-1.5 py-0.5 text-red-600">{{ flashCountdown.m }}</span>:
              <span class="rounded bg-white px-1.5 py-0.5 text-red-600">{{ flashCountdown.s }}</span>
            </div>
          </div>
        </div>
        <ul class="m-0 flex snap-x list-none gap-px overflow-x-auto bg-border p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <li v-for="p in flashProducts" :key="'f' + p.id" class="w-[132px] shrink-0 snap-start bg-card sm:w-[168px]">
            <a :href="'/product/' + p.slug" class="group block p-2">
              <div class="relative aspect-square overflow-hidden rounded bg-muted">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                <span v-if="dealBadge(p)" class="absolute right-0 top-0 rounded-bl bg-yellow-400 px-1.5 py-0.5 text-[11px] font-extrabold text-red-700">{{ dealBadge(p) }}</span>
              </div>
              <p class="mt-1.5 text-base font-bold tabular-nums text-red-600"><span class="text-[11px] font-semibold">RM</span>{{ p.price }}</p>
              <div class="mt-1 h-4">
                <span v-if="lowStock(p)" class="inline-block rounded-full bg-red-50 px-2 py-px text-[10px] font-semibold text-red-600 dark:bg-red-500/10">
                  {{ p.availableStock }} left
                </span>
              </div>
            </a>
          </li>
        </ul>
      </section>

      <!-- Hot products -->
      <section v-if="hotProducts.length" class="overflow-hidden rounded-md bg-card">
        <div class="flex items-center gap-2 border-b border-border px-3 py-2">
          <FlameIcon class="size-4 text-orange-500" />
          <h2 class="text-sm font-extrabold uppercase tracking-wide sm:text-base">Hot Products</h2>
        </div>
        <ol class="m-0 grid list-none gap-px bg-border p-0 md:grid-cols-2 xl:grid-cols-3">
          <li v-for="(p, i) in hotProducts" :key="'h' + p.id" class="bg-card">
            <a :href="'/product/' + p.slug" class="group flex items-center gap-2.5 p-2.5 hover:bg-muted/50">
              <div class="relative shrink-0">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-16 rounded bg-muted object-cover" loading="lazy" width="64" height="64" />
                <span
                  class="absolute left-0 top-0 flex size-5 items-center justify-center rounded-br rounded-tl text-[11px] font-bold tabular-nums text-white"
                  :class="i === 0 ? 'bg-red-600' : i === 1 ? 'bg-orange-500' : i === 2 ? 'bg-amber-500' : 'bg-foreground/40'"
                >{{ i + 1 }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="line-clamp-2 text-[13px] leading-snug group-hover:text-brand">{{ p.name }}</h3>
                <p class="mt-1 text-sm font-bold tabular-nums text-red-600"><span class="text-[11px] font-semibold">RM</span>{{ p.price }}</p>
              </div>
            </a>
          </li>
        </ol>
      </section>

      <!-- All products -->
      <section class="pb-6">
        <div class="sticky top-12 z-30 flex items-center justify-between gap-2 rounded-md bg-card px-3 py-2 sm:top-14">
          <div class="flex min-w-0 items-baseline gap-2">
            <h2 class="text-sm font-extrabold uppercase tracking-wide sm:text-base">{{ messages.storefront.products }}</h2>
            <span class="truncate text-xs text-muted-foreground">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</span>
          </div>
          <div class="flex shrink-0 gap-1">
            <button v-for="s in sortOptions" :key="s.key" type="button" :class="sortClass(sort === s.key)" @click="sort = s.key">{{ s.label }}</button>
          </div>
        </div>

        <ul v-if="sortedProducts.length" class="m-0 mt-2 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <li v-for="p in sortedProducts" :key="p.id">
            <a
              :href="'/product/' + p.slug"
              class="group flex h-full flex-col overflow-hidden rounded-md border border-transparent bg-card transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
            >
              <div class="relative aspect-square overflow-hidden bg-muted">
                <img
                  :src="p.coverImage || defaultProductImage"
                  :alt="p.name"
                  class="size-full object-cover transition duration-300 group-hover:scale-105"
                  :class="p.availableStock === 0 ? 'opacity-50' : ''"
                  loading="lazy"
                />
                <span v-if="dealBadge(p)" class="absolute right-0 top-0 rounded-bl bg-yellow-400 px-1.5 py-0.5 text-[11px] font-extrabold text-red-700">{{ dealBadge(p) }}</span>
                <span v-if="p.availableStock === 0" class="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[11px] font-semibold text-white">{{ messages.storefront.outOfStock }}</span>
              </div>
              <div class="flex flex-1 flex-col p-2">
                <h3 class="line-clamp-2 min-h-[2.5rem] text-[13px] leading-snug">{{ p.name }}</h3>
                <p v-if="p.subtitle" class="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{{ p.subtitle }}</p>
                <div class="mt-auto flex items-end justify-between gap-1 pt-2">
                  <p class="m-0 text-base font-bold tabular-nums leading-none text-red-600"><span class="text-[11px] font-semibold">RM</span>{{ p.price }}</p>
                  <span class="text-[11px] leading-none" :class="stockClass(p)">{{ stockLabel(p) }}</span>
                </div>
              </div>
            </a>
          </li>
        </ul>
        <p v-else class="mt-2 rounded-md bg-card py-16 text-center text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
      </section>
    </div>

    <StorefrontFooter />
  </main>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FlameIcon,
  LayoutGridIcon,
  MegaphoneIcon,
  SearchIcon,
  ZapIcon,
} from "@lucide/vue";
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
const sortOptions: { key: SortKey; label: string }[] = [
  { key: "default", label: "Popular" },
  { key: "asc", label: "Price ↑" },
  { key: "desc", label: "Price ↓" },
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
function catClass(active: boolean) {
  return [
    "flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center transition-colors",
    active ? "bg-brand/10 font-semibold text-brand" : "text-foreground/80 hover:bg-muted",
  ];
}
function catIconClass(active: boolean) {
  return [
    "flex size-9 items-center justify-center rounded-full transition-colors",
    active ? "bg-brand text-white" : "bg-muted text-foreground/70",
  ];
}
function sortClass(active: boolean) {
  return [
    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
    active ? "bg-brand text-white" : "bg-muted text-foreground/70 hover:text-foreground",
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
