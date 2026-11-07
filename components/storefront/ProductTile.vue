<template>
  <a
    :href="href"
    class="tile group block rounded-2xl p-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-brand"
    :style="hue ? { '--hue': hue } : undefined"
  >
    <div class="tile-art relative aspect-square overflow-hidden rounded-xl bg-muted">
      <img
        :src="image"
        :alt="name"
        class="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
        :class="soldOut ? 'opacity-50 grayscale' : ''"
        loading="lazy"
        width="160"
        height="160"
      />
      <span v-if="badge" class="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-sm">{{ badge }}</span>
      <span v-if="soldOut" class="absolute inset-x-0 bottom-0 bg-black/65 py-1 text-center text-[11px] font-medium text-white">{{ stockLabel }}</span>
    </div>

    <div class="px-1 pb-1 pt-2">
      <h3 class="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight group-hover:text-brand">{{ name }}</h3>
      <p v-if="subtitle" class="m-0 mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{{ subtitle }}</p>
      <p class="m-0 mt-1.5 flex items-baseline gap-1 tabular-nums">
        <span v-if="fromLabel" class="text-[11px] text-muted-foreground">{{ fromLabel }}</span>
        <span class="text-[15px] font-bold leading-none"><span class="mr-px text-[11px] font-semibold text-muted-foreground">RM</span>{{ price }}</span>
      </p>
      <div v-if="lowStock" class="mt-1.5 flex items-center gap-1.5">
        <div class="h-1.5 w-14 overflow-hidden rounded-full bg-red-500/15">
          <div class="h-full rounded-full bg-red-500" :style="{ width: Math.max(12, (stock / 20) * 100) + '%' }" />
        </div>
        <span class="text-[10px] font-semibold text-red-500">{{ lowStockLabel }}</span>
      </div>
      <p v-else-if="!soldOut && stockLabel" class="m-0 mt-1 text-[11px] text-muted-foreground">{{ stockLabel }}</p>
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
  fromLabel?: string;
  hue?: string;
}>();
</script>

<style scoped>
/* Each game's own colour glows behind its art; falls back to a neutral plate until sampled. */
.tile {
  --glow: var(--hue, #94a3b8);
  background: radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(--glow) 20%, transparent), transparent 75%);
}
.tile-art {
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.06), 0 8px 18px -12px color-mix(in srgb, var(--glow) 70%, transparent);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.tile:hover .tile-art {
  transform: translateY(-2px);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--glow) 65%, transparent), 0 14px 24px -12px color-mix(in srgb, var(--glow) 80%, transparent);
}
:global(.dark) .tile-art {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 18px -12px color-mix(in srgb, var(--glow) 60%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .tile-art, .tile img { transition: none; }
  .tile:hover .tile-art { transform: none; }
}
</style>
