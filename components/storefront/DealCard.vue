<template>
  <a
    :href="href"
    class="deal group relative flex h-full items-center gap-3 overflow-hidden rounded-2xl bg-card p-2.5 shadow-md outline-none transition focus-visible:ring-2 focus-visible:ring-white"
    :style="hue ? { '--hue': hue } : undefined"
  >
    <div class="relative size-[76px] shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-black/5">
      <img
        :src="image"
        :alt="name"
        class="size-full object-cover transition duration-300 group-hover:scale-105"
        :class="soldOut ? 'opacity-50 grayscale' : ''"
        loading="lazy"
        width="76"
        height="76"
      />
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
      <h3 class="line-clamp-1 text-sm font-semibold leading-tight group-hover:text-brand">{{ name }}</h3>
      <p v-if="subtitle" class="m-0 line-clamp-1 text-[11px] text-muted-foreground">{{ subtitle }}</p>
      <div class="flex items-center gap-2">
        <p class="m-0 text-lg font-extrabold leading-none tabular-nums text-red-600 dark:text-red-400">
          <span class="mr-px text-xs font-bold">RM</span>{{ price }}
        </p>
        <span v-if="badge" class="rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{{ badge }}</span>
      </div>
      <div v-if="soldOut" class="text-[11px] font-medium text-muted-foreground">{{ stockLabel }}</div>
      <div v-else-if="lowStock" class="flex items-center gap-1.5">
        <div class="h-1.5 w-20 overflow-hidden rounded-full bg-red-500/15">
          <div class="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500" :style="{ width: Math.max(12, (stock / 20) * 100) + '%' }" />
        </div>
        <span class="text-[11px] font-bold text-red-500">{{ lowStockLabel }}</span>
      </div>
    </div>
  </a>
</template>

<script lang="ts" setup>
defineProps<{
  href: string;
  name: string;
  subtitle?: string | null;
  image: string;
  price: string | number;
  badge?: string | null;
  soldOut?: boolean;
  stock?: number;
  lowStock?: boolean;
  lowStockLabel?: string;
  stockLabel?: string;
  hue?: string;
}>();
</script>

<style scoped>
/* Game colour washes in from the art side */
.deal {
  --glow: var(--hue, transparent);
  background-image: linear-gradient(100deg, color-mix(in srgb, var(--glow) 22%, transparent) 0%, transparent 60%);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.deal:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px -12px rgba(0, 0, 0, 0.45);
}
@media (prefers-reduced-motion: reduce) {
  .deal, .deal img { transition: none; }
  .deal:hover { transform: none; }
}
</style>
