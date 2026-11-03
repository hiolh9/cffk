<template>
  <main class="flex min-h-screen flex-col bg-[#f3f5f9] text-foreground dark:bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-black/[0.06] bg-white/90 shadow-[0_1px_0_rgba(0,62,170,0.04)] backdrop-blur-md dark:border-border dark:bg-background/90">
      <div class="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-2 px-2 sm:h-14 sm:px-3">
        <StorefrontBrand />
        <div class="relative mx-1 hidden min-w-0 flex-1 md:block md:max-w-sm lg:max-w-md">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand/60" />
          <Input
            v-model="query"
            type="search"
            class="h-9 rounded-full border border-black/[0.06] bg-[#f3f5f9] pl-9 text-sm shadow-none transition focus-visible:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/15 dark:bg-muted"
            :placeholder="messages.storefront.searchProducts"
          />
        </div>
        <PublicNav />
      </div>
    </header>

    <!-- Notice -->
    <div v-if="site.notice" class="border-b border-brand/10 bg-gradient-to-r from-brand/8 via-white to-brand/5">
      <div class="mx-auto flex max-w-[1400px] items-center gap-2 px-2 py-1.5 text-[13px] text-foreground/75 sm:px-3">
        <span class="flex size-5 items-center justify-center rounded-full bg-brand/15">
          <InfoIcon class="size-3 text-brand" />
        </span>
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

    <div class="mx-auto w-full max-w-[1400px] flex-1 px-0 sm:px-2 lg:px-3">
      <!-- Banner -->
      <section v-if="bannerSlides.length" class="relative sm:mt-3 sm:overflow-hidden sm:rounded-2xl sm:shadow-[0_8px_30px_rgba(0,62,170,0.08)]">
        <div class="flex transition-transform duration-500 ease-out" :style="{ transform: 'translateX(-' + bannerIndex * 100 + '%)' }">
          <a
            v-for="slide in bannerSlides"
            :key="slide.id"
            :href="slide.href"
            class="relative block w-full shrink-0 outline-none"
          >
            <div class="h-[18vh] max-h-[25vh] min-h-[88px] w-full bg-gradient-to-br from-[#003EAA]/15 via-[#0088EE]/10 to-[#00D0FF]/10 sm:h-[20vh] sm:max-h-[22vh] dark:from-muted dark:via-muted dark:to-muted">
              <img :src="slide.image" :alt="slide.title" class="h-full w-full object-cover" loading="lazy" />
              <div class="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
              <div v-if="slide.title" class="absolute bottom-0 left-0 max-w-[85%] p-3 sm:p-4">
                <span class="mb-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">Featured</span>
                <h2 class="line-clamp-2 text-sm font-bold leading-snug text-white drop-shadow-sm sm:text-lg">{{ slide.title }}</h2>
                <p v-if="slide.subtitle" class="mt-0.5 line-clamp-1 text-xs text-white/90">{{ slide.subtitle }}</p>
              </div>
            </div>
          </a>
        </div>
        <template v-if="bannerSlides.length > 1">
          <button type="button" class="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/90 text-foreground shadow-md backdrop-blur-sm transition hover:bg-white" aria-label="Prev" @click.prevent="nextBanner(-1)">
            <ChevronLeftIcon class="size-4" />
          </button>
          <button type="button" class="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/90 text-foreground shadow-md backdrop-blur-sm transition hover:bg-white" aria-label="Next" @click.prevent="nextBanner(1)">
            <ChevronRightIcon class="size-4" />
          </button>
          <div class="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
            <button
              v-for="(_, i) in bannerSlides"
              :key="i"
              type="button"
              class="h-1.5 rounded-full transition-all"
              :class="i === bannerIndex ? 'w-5 bg-white shadow-sm' : 'w-1.5 bg-white/55'"
              @click.prevent="bannerIndex = i"
            />
          </div>
        </template>
      </section>

      <!-- Mobile search -->
      <div class="px-2 pt-3 md:hidden">
        <div class="relative">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand/60" />
          <Input
            v-model="query"
            type="search"
            class="h-10 rounded-full border border-black/[0.06] bg-white pl-9 text-sm shadow-sm dark:bg-muted"
            :placeholder="messages.storefront.searchProducts"
          />
        </div>
      </div>

      <!-- Categories -->
      <nav v-if="data.categories.length" class="sticky top-12 z-40 bg-[#f3f5f9]/95 py-2 backdrop-blur sm:top-14 dark:bg-background/95">
        <div class="flex gap-1.5 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-1">
          <button type="button" :class="chipClass(selectedCategory === null)" @click="selectedCategory = null">{{ messages.storefront.all }}</button>
          <button
            v-for="c in data.categories"
            :key="c.id"
            type="button"
            :class="chipClass(selectedCategory === c.id)"
            @click="selectedCategory = c.id"
          >
            {{ c.name }}
          </button>
        </div>
      </nav>

      <!-- Flash | Hot -->
      <div class="mt-1 grid gap-3 md:grid-cols-2 md:gap-4">
        <section class="overflow-hidden rounded-2xl border border-black/[0.04] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:border-border dark:bg-card">
          <div class="flex items-center justify-between gap-2 border-b border-black/[0.04] bg-gradient-to-r from-orange-50 to-transparent px-3 py-2.5 dark:from-orange-500/10 dark:border-border">
            <div class="flex items-center gap-2">
              <span class="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm">
                <ZapIcon class="size-3.5" />
              </span>
              <h2 class="text-sm font-bold sm:text-base">Flash Deals</h2>
            </div>
            <div class="flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums sm:text-xs">
              <span class="rounded-md bg-foreground px-1.5 py-0.5 text-background">{{ flashCountdown.h }}</span>
              <span class="text-muted-foreground">:</span>
              <span class="rounded-md bg-foreground px-1.5 py-0.5 text-background">{{ flashCountdown.m }}</span>
              <span class="text-muted-foreground">:</span>
              <span class="rounded-md bg-foreground px-1.5 py-0.5 text-background">{{ flashCountdown.s }}</span>
            </div>
          </div>
          <ul class="divide-y divide-black/[0.04] dark:divide-border">
            <li v-for="p in flashProducts" :key="'f' + p.id">
              <a
                :href="'/product/' + p.slug"
                class="flex items-center gap-3 px-3 py-2.5 transition hover:bg-gradient-to-r hover:from-brand/[0.04] hover:to-transparent dark:hover:from-brand/10"
              >
                <div class="relative shrink-0">
                  <img
                    :src="p.coverImage || defaultProductImage"
                    :alt="p.name"
                    class="size-14 rounded-xl object-cover ring-1 ring-black/[0.06] sm:size-16"
                    loading="lazy"
                    width="64"
                    height="64"
                  />
                  <span
                    v-if="dealBadge(p)"
                    class="absolute -right-1 -top-1 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 px-1 py-0.5 text-[10px] font-bold text-white shadow-sm"
                  >{{ dealBadge(p) }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground sm:text-base">{{ p.name }}</h3>
                  <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ p.subtitle }}</p>
                  <p class="mt-1 text-[15px] font-bold tabular-nums text-brand sm:text-base">
                    <span class="text-xs font-semibold opacity-80">RM</span>{{ p.price }}
                  </p>
                </div>
                <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground/50" />
              </a>
            </li>
          </ul>
        </section>

        <section class="overflow-hidden rounded-2xl border border-black/[0.04] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:border-border dark:bg-card">
          <div class="flex items-center gap-2 border-b border-black/[0.04] bg-gradient-to-r from-brand/8 to-transparent px-3 py-2.5 dark:border-border">
            <span class="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#003EAA] to-[#0088EE] text-white shadow-sm">
              <FlameIcon class="size-3.5" />
            </span>
            <h2 class="text-sm font-bold sm:text-base">Hot Products</h2>
          </div>
          <ul class="divide-y divide-black/[0.04] dark:divide-border">
            <li v-for="p in hotProducts" :key="'h' + p.id">
              <a
                :href="'/product/' + p.slug"
                class="flex items-center gap-3 px-3 py-2.5 transition hover:bg-gradient-to-r hover:from-brand/[0.04] hover:to-transparent dark:hover:from-brand/10"
              >
                <img
                  :src="p.coverImage || defaultProductImage"
                  :alt="p.name"
                  class="size-14 shrink-0 rounded-xl object-cover ring-1 ring-black/[0.06] sm:size-16"
                  loading="lazy"
                  width="64"
                  height="64"
                />
                <div class="min-w-0 flex-1">
                  <h3 class="line-clamp-2 text-[15px] font-semibold leading-snug sm:text-base">{{ p.name }}</h3>
                  <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ p.subtitle }}</p>
                  <p class="mt-1 text-[15px] font-bold tabular-nums text-brand sm:text-base">
                    <span class="text-xs font-semibold opacity-80">RM</span>{{ p.price }}
                  </p>
                </div>
                <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground/50" />
              </a>
            </li>
          </ul>
        </section>
      </div>

      <!-- All products -->
      <section class="mt-4 mb-8 overflow-hidden rounded-2xl border border-black/[0.04] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:border-border dark:bg-card">
        <div class="flex items-baseline justify-between gap-2 border-b border-black/[0.04] px-3 py-2.5 dark:border-border">
          <h2 class="text-sm font-bold sm:text-base">{{ messages.storefront.products }}</h2>
          <p class="text-xs text-muted-foreground">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</p>
        </div>
        <ul v-if="visibleProducts.length" class="divide-y divide-black/[0.04] dark:divide-border">
          <li v-for="p in visibleProducts" :key="p.id">
            <a
              :href="'/product/' + p.slug"
              class="flex items-center gap-3 px-3 py-2.5 transition hover:bg-gradient-to-r hover:from-brand/[0.04] hover:to-transparent dark:hover:from-brand/10"
            >
              <img
                :src="p.coverImage || defaultProductImage"
                :alt="p.name"
                class="size-14 shrink-0 rounded-xl object-cover ring-1 ring-black/[0.06] sm:size-16"
                loading="lazy"
                width="64"
                height="64"
              />
              <div class="min-w-0 flex-1">
                <h3 class="line-clamp-2 text-[15px] font-semibold leading-snug sm:text-base">{{ p.name }}</h3>
                <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ p.subtitle }}</p>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  <p class="text-[15px] font-bold tabular-nums text-brand sm:text-base">
                    <span class="text-xs font-semibold opacity-80">RM</span>{{ p.price }}
                  </p>
                  <span class="rounded-full bg-[#f3f5f9] px-2 py-0.5 text-[11px] text-muted-foreground dark:bg-muted" :class="stockClass(p)">
                    {{ stockLabel(p) }}
                  </span>
                </div>
              </div>
              <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground/50" />
            </a>
          </li>
        </ul>
        <p v-else class="px-3 py-12 text-center text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
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

const flashProducts = computed(() => visibleProducts.value.slice(0, 5));
const hotProducts = computed(() => {
  const rest = visibleProducts.value.slice(5, 10);
  return rest.length ? rest : visibleProducts.value.slice(0, 5);
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
  if (product.subtitle && /(\d+)\s*%/.test(product.subtitle)) {
    const m = product.subtitle.match(/(\d+)\s*%/);
    return m ? "-" + m[1] + "%" : null;
  }
  return null;
}
function nextBanner(dir: number) {
  const n = bannerSlides.value.length;
  if (n) bannerIndex.value = (bannerIndex.value + dir + n) % n;
}
function chipClass(active: boolean) {
  return [
    "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all",
    active
      ? "bg-brand text-white shadow-sm shadow-brand/25"
      : "border border-black/[0.06] bg-white text-foreground/70 hover:border-brand/30 hover:text-brand dark:border-border dark:bg-card",
  ];
}
function stockLabel(product: Product) {
  if (product.availableStock === null) return messages.value.storefront.stockAvailable;
  return product.availableStock > 0
    ? t(messages.value.storefront.stockCount, { count: product.availableStock })
    : messages.value.storefront.outOfStock;
}
function stockClass(product: Product) {
  return product.availableStock === 0 ? "text-orange-600 bg-orange-50 dark:bg-orange-500/10" : "";
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
