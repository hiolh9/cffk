<template>
  <main class="flex min-h-screen flex-col bg-[#f5f6f8] text-foreground dark:bg-background">
    <header class="sticky top-0 z-50 border-b border-black/[0.06] bg-white dark:border-border dark:bg-background">
      <div class="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-2 px-2 sm:h-14 sm:px-3">
        <StorefrontBrand />
        <div class="relative mx-1 hidden min-w-0 flex-1 md:block md:max-w-xs lg:max-w-sm">
          <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="query" type="search" class="h-9 rounded-full border-transparent bg-[#f0f1f3] pl-8 text-sm shadow-none dark:bg-muted" :placeholder="messages.storefront.searchProducts" />
        </div>
        <PublicNav />
      </div>
    </header>

    <div v-if="site.notice" class="border-b border-black/[0.04] bg-white">
      <div class="mx-auto flex max-w-[1400px] items-center gap-2 px-2 py-1.5 text-[13px] text-muted-foreground sm:px-3">
        <InfoIcon class="size-3.5 shrink-0 text-brand" />
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

    <div class="mx-auto w-full max-w-[1400px] flex-1 px-0 sm:px-2 lg:px-3">
      <!-- Banner full bleed on mobile, no outer card -->
      <section v-if="bannerSlides.length" class="relative sm:mt-2 sm:overflow-hidden sm:rounded-lg">
        <div class="flex transition-transform duration-500 ease-out" :style="{ transform: 'translateX(-' + bannerIndex * 100 + '%)' }">
          <a v-for="slide in bannerSlides" :key="slide.id" :href="slide.href" class="relative block w-full shrink-0">
            <div class="h-[18vh] max-h-[25vh] min-h-[88px] w-full bg-[#e5e9ef] sm:h-[20vh] sm:max-h-[22vh] dark:bg-muted">
              <img :src="slide.image" :alt="slide.title" class="h-full w-full object-cover" loading="lazy" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
              <div v-if="slide.title" class="absolute bottom-0 p-3 sm:p-4">
                <h2 class="line-clamp-2 text-sm font-semibold text-white sm:text-lg">{{ slide.title }}</h2>
                <p v-if="slide.subtitle" class="mt-0.5 line-clamp-1 text-xs text-white/85">{{ slide.subtitle }}</p>
              </div>
            </div>
          </a>
        </div>
        <template v-if="bannerSlides.length > 1">
          <button type="button" class="absolute left-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm" @click.prevent="nextBanner(-1)"><ChevronLeftIcon class="size-3.5" /></button>
          <button type="button" class="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm" @click.prevent="nextBanner(1)"><ChevronRightIcon class="size-3.5" /></button>
          <div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            <button v-for="(_, i) in bannerSlides" :key="i" type="button" class="h-1 rounded-full" :class="i === bannerIndex ? 'w-3.5 bg-white' : 'w-1 bg-white/55'" @click.prevent="bannerIndex = i" />
          </div>
        </template>
      </section>

      <div class="px-2 pt-2 md:hidden sm:px-1">
        <div class="relative">
          <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="query" type="search" class="h-10 rounded-full border-transparent bg-white pl-8 text-sm shadow-sm dark:bg-muted" :placeholder="messages.storefront.searchProducts" />
        </div>
      </div>

      <!-- Categories -->
      <nav v-if="data.categories.length" class="sticky top-12 z-40 border-b border-black/[0.05] bg-[#f5f6f8]/90 backdrop-blur sm:top-14 dark:bg-background/90">
        <div class="flex gap-1 overflow-x-auto px-2 py-1.5 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" :class="chipClass(selectedCategory === null)" @click="selectedCategory = null">{{ messages.storefront.all }}</button>
          <button v-for="c in data.categories" :key="c.id" type="button" :class="chipClass(selectedCategory === c.id)" @click="selectedCategory = c.id">{{ c.name }}</button>
        </div>
      </nav>

      <!-- Flash | Hot side by side on md -->
      <div class="mt-2 grid gap-4 md:grid-cols-2 md:gap-6">
        <section>
          <div class="mb-1.5 flex items-center justify-between px-2 sm:px-1">
            <h2 class="text-sm font-semibold sm:text-base">Flash Deals</h2>
            <div class="font-mono text-xs tabular-nums text-brand sm:text-[13px]">{{ flashCountdown.h }}:{{ flashCountdown.m }}:{{ flashCountdown.s }}</div>
          </div>
          <ul class="divide-y divide-black/[0.05] bg-white sm:overflow-hidden sm:rounded-xl sm:border sm:border-black/[0.05] dark:divide-border dark:bg-card dark:sm:border-border">
            <li v-for="p in flashProducts" :key="'f'+p.id">
              <a :href="'/product/' + p.slug" class="flex items-center gap-3 px-2 py-2 transition hover:bg-black/[0.02] dark:hover:bg-muted/40">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-14 shrink-0 rounded-lg object-cover bg-[#eef1f5] sm:size-16" loading="lazy" width="64" height="64" />
                <div class="min-w-0 flex-1">
                  <h3 class="line-clamp-2 text-[15px] font-medium leading-snug sm:text-base">{{ p.name }}</h3>
                  <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ p.subtitle }}</p>
                  <p class="mt-1 text-[15px] font-semibold tabular-nums text-brand sm:text-base"><span class="text-xs font-semibold">RM</span>{{ p.price }}</p>
                </div>
                <span v-if="dealBadge(p)" class="shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand">{{ dealBadge(p) }}</span>
              </a>
            </li>
          </ul>
        </section>

        <section>
          <div class="mb-1.5 px-2 sm:px-1">
            <h2 class="text-sm font-semibold sm:text-base">Hot Products</h2>
          </div>
          <ul class="divide-y divide-black/[0.05] bg-white sm:overflow-hidden sm:rounded-xl sm:border sm:border-black/[0.05] dark:divide-border dark:bg-card dark:sm:border-border">
            <li v-for="p in hotProducts" :key="'h'+p.id">
              <a :href="'/product/' + p.slug" class="flex items-center gap-3 px-2 py-2 transition hover:bg-black/[0.02] dark:hover:bg-muted/40">
                <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-14 shrink-0 rounded-lg object-cover bg-[#eef1f5] sm:size-16" loading="lazy" width="64" height="64" />
                <div class="min-w-0 flex-1">
                  <h3 class="line-clamp-2 text-[15px] font-medium leading-snug sm:text-base">{{ p.name }}</h3>
                  <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ p.subtitle }}</p>
                  <p class="mt-1 text-[15px] font-semibold tabular-nums text-brand sm:text-base"><span class="text-xs font-semibold">RM</span>{{ p.price }}</p>
                </div>
              </a>
            </li>
          </ul>
        </section>
      </div>

      <!-- All: Play Store horizontal rows -->
      <section class="mt-4 mb-6">
        <div class="mb-1.5 flex items-baseline justify-between px-2 sm:px-1">
          <h2 class="text-sm font-semibold sm:text-base">{{ messages.storefront.products }}</h2>
          <p class="text-xs text-muted-foreground">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</p>
        </div>
        <ul v-if="visibleProducts.length" class="divide-y divide-black/[0.05] bg-white sm:overflow-hidden sm:rounded-xl sm:border sm:border-black/[0.05] dark:divide-border dark:bg-card dark:sm:border-border">
          <li v-for="p in visibleProducts" :key="p.id">
            <a :href="'/product/' + p.slug" class="flex items-center gap-3 px-2 py-2 transition hover:bg-black/[0.02] dark:hover:bg-muted/40">
              <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="size-14 shrink-0 rounded-lg object-cover bg-[#eef1f5] sm:size-16" loading="lazy" width="64" height="64" />
              <div class="min-w-0 flex-1">
                <h3 class="line-clamp-2 text-[15px] font-medium leading-snug sm:text-base">{{ p.name }}</h3>
                <p v-if="p.subtitle" class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ p.subtitle }}</p>
                <div class="mt-1 flex items-center gap-2">
                  <p class="text-[15px] font-semibold tabular-nums text-brand sm:text-base"><span class="text-xs font-semibold">RM</span>{{ p.price }}</p>
                  <span class="text-xs text-muted-foreground" :class="stockClass(p)">{{ stockLabel(p) }}</span>
                </div>
              </div>
            </a>
          </li>
        </ul>
        <p v-else class="px-2 py-8 text-center text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
      </section>
    </div>
    <StorefrontFooter />
  </main>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, SearchIcon } from "@lucide/vue";
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
    "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium",
    active ? "bg-brand text-white" : "text-foreground/70 hover:bg-white",
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

onMounted(() => {
  tickTimer = setInterval(() => { nowTick.value = Date.now(); }, 1000);
  bannerTimer = setInterval(() => { if (bannerSlides.value.length > 1) nextBanner(1); }, 5500);
});
onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
  if (bannerTimer) clearInterval(bannerTimer);
});
</script>
