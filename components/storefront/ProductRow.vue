<template>
  <a
    :href="href"
    class="row group flex items-center gap-3 rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-brand"
    :class="compact ? 'row-compact p-1.5' : 'row-full p-2.5'"
    :style="hue ? { '--hue': hue } : undefined"
  >
    <div
      class="relative shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      :class="compact ? 'size-12' : 'size-16 sm:size-[72px]'"
    >
      <img
        :src="image"
        :alt="name"
        class="size-full object-cover transition duration-300 group-hover:scale-105"
        :class="soldOut ? 'opacity-50 grayscale' : ''"
        loading="lazy"
        :width="compact ? 48 : 72"
        :height="compact ? 48 : 72"
      />
    </div>

    <div class="min-w-0 flex-1">
      <h3 class="line-clamp-2 text-[13px] font-semibold leading-snug group-hover:text-brand">{{ name }}</h3>
      <p v-if="subtitle && !compact" class="m-0 mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{{ subtitle }}</p>
      <p class="m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span class="font-bold tabular-nums"><span class="mr-px text-[10px] font-semibold text-muted-foreground">RM</span>{{ price }}</span>
        <span v-if="soldOut" class="font-medium text-red-500">{{ stockLabel }}</span>
        <span v-else-if="lowStock" class="font-medium text-red-500">{{ lowStockLabel }}</span>
        <span v-else-if="stockLabel && !compact" class="text-muted-foreground">{{ stockLabel }}</span>
      </p>
    </div>

    <span v-if="badge" class="shrink-0 self-start rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{{ badge }}</span>
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
  compact?: boolean;
}>();
</script>

<style scoped>
/* Full rows carry the game's own colour as a soft wash from the icon side. */
.row-full {
  background-color: color-mix(in srgb, var(--hue, #94a3b8) 6%, transparent);
  background-image: linear-gradient(100deg, color-mix(in srgb, var(--hue, transparent) 26%, transparent) 0%, transparent 70%);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
}
.row-full:hover {
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--hue, #64748b) 55%, transparent);
}
/* Compact rows are plain list items inside a panel. */
.row-compact:hover {
  background-color: rgba(148, 163, 184, 0.14);
}
@media (prefers-reduced-motion: reduce) {
  .row img { transition: none; }
}
</style>
