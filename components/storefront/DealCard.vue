<template>
  <a
    :href="href"
    class="deal group flex h-full flex-col overflow-hidden rounded-2xl bg-card outline-none transition focus-visible:ring-2 focus-visible:ring-brand"
    :style="hue ? { '--hue': hue } : undefined"
  >
    <div class="flex items-center gap-3 p-3">
      <div class="size-14 shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <img
          :src="image"
          :alt="name"
          class="size-full object-cover transition duration-300 group-hover:scale-105"
          :class="soldOut ? 'opacity-50 grayscale' : ''"
          loading="lazy"
          width="56"
          height="56"
        />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="line-clamp-1 text-sm font-semibold group-hover:text-brand">{{ name }}</h3>
        <p v-if="subtitle" class="m-0 mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ subtitle }}</p>
      </div>
    </div>

    <div class="mt-auto flex items-center justify-between gap-2 px-3 pb-3">
      <p class="m-0 text-base font-bold tabular-nums"><span class="mr-px text-xs font-semibold text-muted-foreground">RM</span>{{ price }}</p>
      <span v-if="soldOut" class="text-xs font-medium text-red-500">{{ stockLabel }}</span>
      <span v-else-if="badge" class="rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{{ badge }}</span>
      <span v-else-if="lowStock" class="text-xs font-medium text-red-500">{{ lowStockLabel }}</span>
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
/* Same colour language as the list rows: the game's own colour tints the card. */
.deal {
  background-image: linear-gradient(135deg, color-mix(in srgb, var(--hue, transparent) 34%, transparent) 0%, color-mix(in srgb, var(--hue, transparent) 10%, transparent) 100%);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.deal:hover {
  transform: translateY(-2px);
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--hue, #64748b) 55%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .deal, .deal img { transition: none; }
  .deal:hover { transform: none; }
}
</style>
