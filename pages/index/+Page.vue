<template>
  <main class="flex min-h-screen flex-col bg-[#f0f2f5] text-foreground dark:bg-background">
    <!-- Header -->
    <header class="fixed inset-x-0 top-0 z-50 border-b border-black/[0.06] bg-white/95 backdrop-blur-md dark:border-border dark:bg-background/95">
      <div class="mx-auto flex h-12 max-w-[1100px] items-center justify-between gap-2 px-3 sm:h-13 sm:px-5">
        <StorefrontBrand />
        <div class="relative mx-2 hidden min-w-0 flex-1 md:block md:max-w-sm lg:max-w-md">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            type="search"
            class="h-9 rounded-full border-transparent bg-[#f0f2f5] pl-9 text-sm shadow-none focus-visible:border-brand/30 focus-visible:ring-brand/20 dark:bg-muted"
            :placeholder="messages.storefront.searchProducts"
          />
        </div>
        <PublicNav />
      </div>
    </header>

    <div :class="site.notice ? 'pt-12 sm:pt-13' : 'pt-12 sm:pt-13'" class="flex flex-1 flex-col">
      <!-- Notice (subtle strip, not a big block) -->
      <div v-if="site.notice" class="border-b border-brand/10 bg-white">
        <div class="mx-auto flex max-w-[1100px] items-center gap-2 px-3 py-1.5 text-[12px] text-foreground/70 sm:px-5">
          <InfoIcon class="size-3.5 shrink-0 text-brand" />
          <p class="m-0 truncate">{{ site.notice }}</p>
        </div>
      </div>

      <!-- One continuous stage -->
      <div class="mx-auto w-full max-w-[1100px] flex-1 px-3 py-3 sm:px-5 sm:py-4">
        <div class="overflow-hidden rounded-2xl border border-black/[0.04] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-border dark:bg-card">
          <!-- Banner -->
          <div v-if="bannerSlides.length" class="relative border-b border-black/[0.04] dark:border-border">
            <div class="flex transition-transform duration-500 ease-out" :style="{ transform: 'translateX(-' + bannerIndex * 100 + '%)' }">
              <a
                v-for="slide in bannerSlides"
                :key="slide.id"
                :href="slide.href"
                class="relative block w-full shrink-0 outline-none"
              >
                <div class="aspect-[2.2/1] w-full bg-[#e8eef5] sm:aspect-[3.2/1] dark:bg-muted">
                  <img :src="slide.image" :alt="slide.title" class="h-full w-full object-cover" loading="lazy" decoding="async" />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent sm:bg-gradient-to-r sm:from-black/40 sm:via-black/10 sm:to-transparent" />
                  <div v-if="slide.title" class="absolute bottom-0 left-0 max-w-[90%] p-3 sm:max-w-md sm:p-5">
                    <h2 class="line-clamp-2 text-[13px] font-semibold leading-snug text-white sm:text-lg">{{ slide.title }}</h2>
                    <p v-if="slide.subtitle" class="mt-0.5 line-clamp-1 text-[11px] text-white/85 sm:text-sm">{{ slide.subtitle }}</p>
                  </div>
                </div>
              </a>
            </div>
            <template v-if="bannerSlides.length > 1">
              <button type="button" class="absolute left-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm hover:bg-white" aria-label="Prev" @click.prevent="nextBanner(-1)">
                <ChevronLeftIcon class="size-3.5" />
              </button>
              <button type="button" class="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm hover:bg-white" aria-label="Next" @click.prevent="nextBanner(1)">
                <ChevronRightIcon class="size-3.5" />
              </button>
              <div class="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
                <button
                  v-for="(_, i) in bannerSlides"
                  :key="i"
                  type="button"
                  class="h-1 rounded-full transition-all"
                  :class="i === bannerIndex ? 'w-4 bg-white' : 'w-1 bg-white/60'"
                  @click.prevent="bannerIndex = i"
                />
              </div>
            </template>
          </div>

          <!-- Mobile search inside card -->
          <div class="border-b border-black/[0.04] px-3 py-2 md:hidden dark:border-border">
            <div class="relative">
              <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input v-model="query" type="search" class="h-9 rounded-full border-transparent bg-[#f0f2f5] pl-9 text-sm shadow-none dark:bg-muted" :placeholder="messages.storefront.searchProducts" />
            </div>
          </div>

          <!-- Categories: chips row, light -->
          <div v-if="data.categories.length" class="border-b border-black/[0.04] px-3 py-2 sm:px-4 dark:border-border">
            <div class="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button type="button" :class="chipClass(selectedCategory === null)" @click="selectedCategory = null">{{ messages.storefront.all }}</button>
              <button v-for="c in data.categories" :key="c.id" type="button" :class="chipClass(selectedCategory === c.id)" @click="selectedCategory = c.id">{{ c.name }}</button>
            </div>
          </div>

          <!-- Flash (left) + Hot (right) -->
          <div class="grid gap-0 md:grid-cols-2 md:divide-x md:divide-black/[0.04] dark:md:divide-border">
            <!-- Flash -->
            <section class="p-3 sm:p-4">
              <div class="mb-2.5 flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5">
                  <span class="text-[13px] font-semibold text-foreground">Flash Deals</span>
                  <div class="flex items-center gap-0.5 font-mono text-[11px] font-medium tabular-nums text-brand">
                    <span class="rounded bg-brand/10 px-1 py-0.5 text-brand">{{ flashCountdown.h }}</span>
                    <span class="text-brand/50">:</span>
                    <span class="rounded bg-brand/10 px-1 py-0.5 text-brand">{{ flashCountdown.m }}</span>
                    <span class="text-brand/50">:</span>
                    <span class="rounded bg-brand/10 px-1 py-0.5 text-brand">{{ flashCountdown.s }}</span>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <article
                  v-for="p in flashProducts"
                  :key="'f' + p.id"
                  class="group overflow-hidden rounded-lg bg-[#f7f9fc] transition hover:bg-[#eef3f9] dark:bg-muted/40 dark:hover:bg-muted/60"
                >
                  <a :href="'/product/' + p.slug" class="block">
                    <div class="relative aspect-square overflow-hidden bg-[#e8eef5] dark:bg-muted">
                      <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
                      <span
                        v-if="dealBadge(p)"
                        class="absolute right-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
                      >{{ dealBadge(p) }}</span>
                    </div>
                    <div class="space-y-0.5 p-1.5 sm:p-2">
                      <h3 class="line-clamp-2 min-h-[2rem] text-[11.5px] font-medium leading-snug text-foreground/90">{{ p.name }}</h3>
                      <p class="text-[13px] font-bold tabular-nums text-brand"><span class="text-[10px] font-semibold">RM</span>{{ p.price }}</p>
                    </div>
                  </a>
                </article>
              </div>
              <p v-if="!flashProducts.length" class="py-6 text-center text-xs text-muted-foreground">—</p>
            </section>

            <!-- Hot -->
            <section class="border-t border-black/[0.04] p-3 sm:p-4 md:border-t-0 dark:border-border">
              <div class="mb-2.5 flex items-center gap-1.5">
                <span class="text-[13px] font-semibold text-foreground">Hot Products</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <article
                  v-for="p in hotProducts"
                  :key="'h' + p.id"
                  class="group overflow-hidden rounded-lg bg-[#f7f9fc] transition hover:bg-[#eef3f9] dark:bg-muted/40 dark:hover:bg-muted/60"
                >
                  <a :href="'/product/' + p.slug" class="block">
                    <div class="aspect-square overflow-hidden bg-[#e8eef5] dark:bg-muted">
                      <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
                    </div>
                    <div class="space-y-0.5 p-1.5 sm:p-2">
                      <h3 class="line-clamp-2 min-h-[2rem] text-[11.5px] font-medium leading-snug text-foreground/90">{{ p.name }}</h3>
                      <p class="text-[13px] font-bold tabular-nums text-brand"><span class="text-[10px] font-semibold">RM</span>{{ p.price }}</p>
                    </div>
                  </a>
                </article>
              </div>
              <p v-if="!hotProducts.length" class="py-6 text-center text-xs text-muted-foreground">—</p>
            </section>
          </div>

          <!-- All products -->
          <section class="border-t border-black/[0.04] p-3 sm:p-4 dark:border-border">
            <div class="mb-2.5 flex items-baseline justify-between gap-2">
              <h2 class="text-[13px] font-semibold text-foreground">{{ messages.storefront.products }}</h2>
              <p class="text-[11px] text-muted-foreground">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</p>
            </div>
            <div v-if="visibleProducts.length" class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              <article
                v-for="p in visibleProducts"
                :key="p.id"
                class="group overflow-hidden rounded-lg bg-[#f7f9fc] transition hover:bg-[#eef3f9] dark:bg-muted/40"
              >
                <a :href="'/product/' + p.slug" class="block">
                  <div class="aspect-square overflow-hidden bg-[#e8eef5] dark:bg-muted">
                    <img :src="p.coverImage || defaultProductImage" :alt="p.name" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
                  </div>
                  <div class="space-y-0.5 p-1.5 sm:p-2">
                    <h3 class="line-clamp-2 min-h-[2rem] text-[11.5px] font-medium leading-snug">{{ p.name }}</h3>
                    <p class="text-[13px] font-bold tabular-nums text-brand"><span class="text-[10px] font-semibold">RM</span>{{ p.price }}</p>
                  </div>
                </a>
              </article>
            </div>
            <p v-else class="py-10 text-center text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
          </section>
        </div>
      </div>
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
    const arr = JSON.parse(raw) as Array<{
      image?: string;
      title?: string;
      subtitle?: string;
      href?: string;
      link?: string;
    }>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.image === "string" && x.image.trim())
      .slice(0, 10)
      .map((x, i) => ({
        id: "custom-" + i,
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

/** Flash left: first half / deals; Hot right: next items — no heavy orange chrome */
const flashProducts = computed(() => visibleProducts.value.slice(0, 4));
const hotProducts = computed(() => {
  const rest = visibleProducts.value.slice(4, 8);
  return rest.length ? rest : visibleProducts.value.slice(0, 4);
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
  if (product.availableStock === 0) return null;
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
    "shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
    active
      ? "bg-brand text-white"
      : "bg-transparent text-foreground/65 hover:bg-[#eef2f7] hover:text-foreground dark:hover:bg-muted",
  ];
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
