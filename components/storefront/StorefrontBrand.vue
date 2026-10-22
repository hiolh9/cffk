<template>
  <a href="/" class="group flex min-w-0 items-center gap-2.5 font-semibold" :aria-label="homeLabel">
    <span class="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      <img :src="brandLogoUrl" :alt="`${siteName} Logo`" class="size-full object-contain" />
    </span>
    <span class="brand-text-gradient truncate text-base font-extrabold tracking-tight sm:text-[1.05rem]">{{ siteName }}</span>
  </a>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePageContext } from "vike-vue/usePageContext";

import logoUrl from "@/assets/logo.svg?url";

type Site = { name?: string | null; logo?: string | null };
type PageContext = ReturnType<typeof usePageContext> & { site?: Site | null };

const pageContext = usePageContext() as PageContext;
const siteName = computed(() => pageContext.site?.name?.trim() || "Sparkpay");
const brandLogoUrl = computed(() => pageContext.site?.logo || logoUrl);
const homeLabel = computed(() => siteName.value);
</script>
