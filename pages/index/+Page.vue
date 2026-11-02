<template>
  <main class="flex min-h-screen flex-col bg-[#f5f7fa] text-foreground dark:bg-background">
    <header class="fixed inset-x-0 top-0 z-50 border-b border-black/[0.06] bg-white/95 backdrop-blur-md dark:border-border dark:bg-background/95">
      <div class="mx-auto flex h-12 max-w-[1100px] items-center justify-between gap-2 px-3 sm:h-14 sm:px-5">
        <StorefrontBrand />
        <div class="relative mx-2 hidden min-w-0 flex-1 md:block md:max-w-md">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="query" type="search" class="h-9 rounded-full border-black/8 bg-[#f5f7fa] pl-9 text-sm shadow-none" :placeholder="messages.storefront.searchProducts" />
        </div>
        <PublicNav />
      </div>
    </header>

    <div v-if="site.notice" class="border-b border-brand/15 bg-brand-soft pt-12 sm:pt-14">
      <div class="mx-auto flex max-w-[1100px] items-center gap-2 px-3 py-1.5 text-xs sm:px-5">
        <InfoIcon class="size-3.5 shrink-0 text-brand" />
        <p class="m-0 truncate">{{ site.notice }}</p>
      </div>
    </div>

    <section :class="site.notice ? '' : 'pt-12 sm:pt-14'" class="bg-white md:hidden dark:bg-background">
      <div class="mx-auto max-w-[1100px] px-3 py-2">
        <div class="relative">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="query" type="search" class="h-9 rounded-full bg-[#f5f7fa] pl-9 text-sm" :placeholder="messages.storefront.searchProducts" />
        </div>
      </div>
    </section>

    <section class="mx-auto w-full max-w-[1100px] px-3 pt-3 sm:px-5">
      <div v-if="bannerSlides.length" class="relative overflow-hidden rounded-xl border border-black/5 bg-white dark:border-border">
        <div class="flex transition-transform duration-500" :style="{ transform: 'translateX(-' + bannerIndex * 100 + '%)' }">
          <a v-for="slide in bannerSlides" :key="slide.id" :href="slide.href" class="relative block w-full shrink-0">
            <div class="aspect-[2/1] bg-muted sm:aspect-[3/1]">
              <img :src="slide.image" :alt="slide.title" class="h-full w-full object-cover" loading="lazy" />
              <div class="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
              <div class="absolute bottom-0 p-3 sm:p-5">
                <p class="text-[10px] font-semibold uppercase text-white/80">Featured</p>
                <h2 class="line-clamp-2 text-sm font-bold text-white sm:text-lg">{{ slide.title }}</h2>
              </div>
            </div>
          </a>
        </div>
        <button v-if="bannerSlides.length > 1" type="button" class="absolute left-2 top-1/2 size-7 -translate-y-1/2 rounded-full bg-black/40 text-white" @click.prevent="nextBanner(-1)"><ChevronLeftIcon class="mx-auto size-3.5" /></button>
        <button v-if="bannerSlides.length > 1" type="button" class="absolute right-2 top-1/2 size-7 -translate-y-1/2 rounded-full bg-black/40 text-white" @click.prevent="nextBanner(1)"><ChevronRightIcon class="mx-auto size-3.5" /></button>
        <div v-if="bannerSlides.length > 1" class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
          <button v-for="(_, i) in bannerSlides" :key="i" type="button" class="h-1.5 rounded-full" :class="i === bannerIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'" @click.prevent="bannerIndex = i" />
        </div>
      </div>
    </section>

    <nav v-if="data.categories.length" class="sticky top-12 z-40 border-b bg-white/95 backdrop-blur sm:top-14 dark:bg-background/95">
      <div class="mx-auto flex max-w-[1100px] gap-2 overflow-x-auto px-3 py-2 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" :class="chipClass(selectedCategory === null)" @click="selectedCategory = null">{{ messages.storefront.all }}</button>
        <button v-for="c in data.categories" :key="c.id" type="button" :class="chipClass(selectedCategory === c.id)" @click="selectedCategory = c.id">{{ c.name }}</button>
      </div>
    </nav>

    <div class="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-6 px-3 py-4 sm:px-5">
      <section v-if="flashProducts.length">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="flex size-6 items-center justify-center rounded-md bg-orange-500 text-white"><ZapIcon class="size-3" /></span>
          <h2 class="text-sm font-bold">Flash Deals</h2>
          <div class="flex gap-0.5 font-mono text-[11px] font-semibold text-white">
            <span class="rounded bg-orange-500 px-1 py-0.5">{{ flashCountdown.h }}</span><span class="text-orange-600">:</span>
            <span class="rounded bg-orange-500 px-1 py-0.5">{{ flashCountdown.m }}</span><span class="text-orange-600">:</span>
            <span class="rounded bg-orange-500 px-1 py-0.5">{{ flashCountdown.s }}</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          <article v-for="p in flashProducts" :key="'f'+p.id" class="relative overflow-hidden rounded-xl border border-black/5 bg-white dark:border-border dark:bg-card">
            <span v-if="dealBadge(p)" class="absolute left-1.5 top-1.5 z-10 rounded px-1.5 py-0.5 text-[10px] font-bold text-white" :class="dealBadge(p)==='HOT'?'bg-rose-500':'bg-orange-500'">{{ dealBadge(p) }}</span>
            <a :href="'/product/' + p.slug" class="block">
              <div class="aspect-square overflow-hidden bg-muted"><img :src="p.coverImage || defaultProductImage" :alt="p.name" class="h-full w-full object-cover" loading="lazy" /></div>
              <div class="p-2"><h3 class="line-clamp-2 min-h-[2.1rem] text-[12px] font-medium">{{ p.name }}</h3>
              <p class="text-[13px] font-bold text-brand"><span class="text-[10px]">RM</span>{{ p.price }}</p></div>
            </a>
          </article>
        </div>
      </section>

      <section v-if="hotProducts.length">
        <div class="mb-2 flex items-center gap-2">
          <span class="flex size-6 items-center justify-center rounded-md bg-brand text-white"><FlameIcon class="size-3" /></span>
          <h2 class="text-sm font-bold">Hot Products</h2>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <article v-for="p in hotProducts" :key="'h'+p.id" class="overflow-hidden rounded-xl border border-black/5 bg-white dark:border-border dark:bg-card">
            <a :href="'/product/' + p.slug" class="block">
              <div class="aspect-square overflow-hidden bg-muted"><img :src="p.coverImage || defaultProductImage" :alt="p.name" class="h-full w-full object-cover" loading="lazy" /></div>
              <div class="p-2"><h3 class="line-clamp-2 min-h-[2.1rem] text-[12px] font-medium">{{ p.name }}</h3>
              <p class="text-[13px] font-bold text-brand"><span class="text-[10px]">RM</span>{{ p.price }}</p></div>
            </a>
          </article>
        </div>
      </section>

      <section>
        <div class="mb-2 flex justify-between">
          <h2 class="text-[13px] font-semibold uppercase text-foreground/80">{{ messages.storefront.products }}</h2>
          <p class="text-[11px] text-muted-foreground">{{ t(messages.storefront.relatedProducts, { count: visibleProducts.length }) }}</p>
        </div>
        <div v-if="visibleProducts.length" class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <article v-for="p in visibleProducts" :key="p.id" class="overflow-hidden rounded-xl border border-black/5 bg-white dark:border-border dark:bg-card">
            <a :href="'/product/' + p.slug" class="block">
              <div class="aspect-square overflow-hidden bg-muted"><img :src="p.coverImage || defaultProductImage" :alt="p.name" class="h-full w-full object-cover" loading="lazy" /></div>
              <div class="p-2">
                <h3 class="line-clamp-2 min-h-[2.1rem] text-[12px] font-medium">{{ p.name }}</h3>
                <p v-if="p.subtitle" class="line-clamp-1 text-[11px] text-muted-foreground">{{ p.subtitle }}</p>
                <p class="text-[13px] font-bold text-brand"><span class="text-[10px]">RM</span>{{ p.price }}</p>
              </div>
            </a>
          </article>
        </div>
        <p v-else class="py-10 text-center text-sm text-muted-foreground">{{ messages.storefront.noProducts }}</p>
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
type Site = { name: string; subtitle: string | null; logo: string | null; notice: string | null; footerText: string | null };

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
      (!keyword || p.name.toLowerCase().includes(keyword) || (p.subtitle && p.subtitle.toLowerCase().includes(keyword))),
  );
});

const bannerIndex = ref(0);
let bannerTimer: ReturnType<typeof setInterval> | null = null;
const bannerSlides = computed(() => {
  const withImg = data.products.filter((p) => p.coverImage);
  const list = (withImg.length ? withImg : data.products).slice(0, 6);
  return list.map((p) => ({
    id: p.id,
    title: p.name,
    image: p.coverImage || defaultProductImage,
    href: "/product/" + p.slug,
  }));
});

const hotProducts = computed(() => visibleProducts.value.slice(0, 10));
const flashProducts = computed(() => {
  const marked = visibleProducts.value.filter(
    (p) => p.subtitle && (/%|off|折扣|特惠|sale/i.test(p.subtitle) || p.availableStock !== null),
  );
  return (marked.length >= 2 ? marked : visibleProducts.value.slice(0, 8)).slice(0, 8);
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
    return m ? "-" + m[1] + "%" : "DEAL";
  }
  if (product.availableStock !== null && product.availableStock > 0 && product.availableStock <= 20) return "HOT";
  return "DEAL";
}
function nextBanner(dir: number) {
  const n = bannerSlides.value.length;
  if (n) bannerIndex.value = (bannerIndex.value + dir + n) % n;
}
function chipClass(active: boolean) {
  return [
    "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium",
    active ? "bg-brand text-white" : "bg-[#eef2f7] text-foreground/70 dark:bg-muted",
  ];
}

onMounted(() => {
  tickTimer = setInterval(() => { nowTick.value = Date.now(); }, 1000);
  bannerTimer = setInterval(() => { if (bannerSlides.value.length > 1) nextBanner(1); }, 5000);
});
onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
  if (bannerTimer) clearInterval(bannerTimer);
});
</script>
