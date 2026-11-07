<template>
  <a
    :href="href"
    class="row group flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-brand"
    :class="[compact ? 'row-compact rounded-xl p-1.5' : 'row-full rounded-2xl p-3', hue ? 'has-hue' : '']"
    :style="hue ? { '--hue': hue } : undefined"
  >
    <div
      class="icon relative shrink-0 overflow-hidden bg-muted"
      :class="compact ? 'size-12 rounded-xl' : 'size-[68px] rounded-2xl sm:size-[76px]'"
    >
      <img
        :src="image"
        :alt="name"
        class="size-full object-cover"
        :class="soldOut ? 'opacity-50 grayscale' : ''"
        loading="lazy"
        :width="compact ? 48 : 76"
        :height="compact ? 48 : 76"
      />
    </div>

    <div class="min-w-0 flex-1">
      <h3 class="line-clamp-2 font-semibold leading-snug" :class="compact ? 'text-[13px]' : 'text-sm'">{{ name }}</h3>
      <p v-if="subtitle && !compact" class="m-0 mt-0.5 line-clamp-1 text-xs text-foreground/65">{{ subtitle }}</p>

      <div v-if="compact" class="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        <span class="font-bold tabular-nums"><span class="mr-px text-[10px] font-semibold text-foreground/60">RM</span>{{ price }}</span>
        <span v-if="soldOut" class="font-medium text-red-500">{{ stockLabel }}</span>
        <span v-else-if="lowStock" class="font-medium text-red-500">{{ lowStockLabel }}</span>
      </div>

      <div v-else class="mt-2 flex items-center justify-between gap-2">
        <span class="price rounded-lg px-2 py-1 text-[13px] font-bold leading-none tabular-nums">
          <span class="mr-px text-[10px] font-semibold opacity-70">RM</span>{{ price }}
        </span>
        <span v-if="soldOut" class="text-xs font-semibold text-red-500">{{ stockLabel }}</span>
        <span v-else-if="badge" class="rounded-md bg-red-600 px-1.5 py-1 text-[11px] font-bold leading-none text-white shadow-sm">{{ badge }}</span>
        <span v-else-if="lowStock" class="text-xs font-semibold text-red-500">{{ lowStockLabel }}</span>
        <span v-else-if="stockLabel" class="truncate text-[11px] text-foreground/60">{{ stockLabel }}</span>
      </div>
    </div>

    <span v-if="badge && compact" class="shrink-0 self-start rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{{ badge }}</span>
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
/*
 * Smoothness rules used here:
 *  - Gradients can't be transitioned, so the colour wash lives on ::before and FADES in by opacity
 *    when the icon colour arrives (no sudden colour pop).
 *  - The hover shadow lives on ::after and fades by opacity (no box-shadow repaint animation).
 *  - Only transform and opacity are ever animated; hover effects only on devices that can hover.
 */
.row {
  --h: var(--hue, #94a3b8);
  --base: #ffffff;
  --strong: 44%;
  --soft: 18%;
  position: relative;
  isolation: isolate;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
:global(.dark) .row {
  --base: #141925;
  --strong: 52%;
  --soft: 22%;
}
.row::before,
.row::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
.row::before {
  z-index: -1;
  background: linear-gradient(115deg, color-mix(in srgb, var(--h) var(--strong), var(--base)) 0%, color-mix(in srgb, var(--h) var(--soft), var(--base)) 100%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--h) 45%, transparent);
  opacity: 0;
  transition: opacity 0.7s ease;
}
.row.has-hue::before {
  opacity: 1;
}
.row::after {
  z-index: -2;
  box-shadow: 0 16px 26px -14px color-mix(in srgb, var(--h) 90%, transparent);
  opacity: 0;
  transition: opacity 0.35s ease;
}

.row-full {
  background-color: var(--base);
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.2);
}
.row-full .icon {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.55), 0 8px 16px -8px color-mix(in srgb, var(--h) 90%, #000);
}
:global(.dark) .row-full .icon {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18), 0 8px 16px -8px rgba(0, 0, 0, 0.7);
}
.price {
  background: color-mix(in srgb, var(--h) 30%, var(--base));
}

/* Compact rows: lighter wash, no lift */
.row-compact {
  --strong: 18%;
  --soft: 8%;
}
.row-compact::before {
  box-shadow: none;
}
.row-compact::after {
  display: none;
}

.row img {
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (hover: hover) {
  .row-full:hover {
    transform: translateY(-3px);
  }
  .row-full:hover::after {
    opacity: 1;
  }
  .row:hover img {
    transform: scale(1.06);
  }
  .row-compact:hover::before {
    --strong: 30%;
    --soft: 16%;
  }
}
.row-full:active {
  transform: scale(0.985);
  transition-duration: 0.12s;
}

@media (prefers-reduced-motion: reduce) {
  .row,
  .row::before,
  .row::after,
  .row img {
    transition: none;
  }
  .row-full:hover,
  .row-full:active {
    transform: none;
  }
}
</style>
