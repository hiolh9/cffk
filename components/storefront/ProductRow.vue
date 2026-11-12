<template>
  <!-- Full row: a deep, icon-coloured card. Compact row: a calm list item for use inside panels. -->
  <a
    :href="href"
    class="row group outline-none"
    :class="[
      compact
        ? 'row-compact flex items-center gap-3 rounded-xl p-2 focus-visible:ring-2 focus-visible:ring-brand'
        : 'row-full relative flex items-center gap-3 rounded-2xl p-2.5 text-white sm:gap-3.5 sm:p-3 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      hue ? 'has-hue' : '',
      soldOut ? 'is-sold' : '',
    ]"
    :style="hue ? { '--hue': hue } : undefined"
  >
    <div
      class="icon relative shrink-0 overflow-hidden bg-black/20"
      :class="compact ? 'size-12 rounded-xl' : 'size-16 rounded-2xl sm:size-20 sm:rounded-[18px]'"
    >
      <img
        :src="image"
        :alt="name"
        class="size-full object-cover"
        :class="soldOut ? 'opacity-60 grayscale' : ''"
        loading="lazy"
        :width="compact ? 48 : 80"
        :height="compact ? 48 : 80"
      />
    </div>

    <!-- Compact -->
    <div v-if="compact" class="min-w-0 flex-1">
      <h3 class="line-clamp-2 text-sm font-semibold leading-snug">{{ name }}</h3>
      <p class="m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span class="font-bold tabular-nums"><span class="mr-0.5 text-[10px] font-semibold text-muted-foreground">RM</span>{{ price }}</span>
        <span v-if="badge" class="rounded bg-red-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white">{{ badge }}</span>
        <span v-if="soldOut" class="font-medium text-muted-foreground">{{ stockLabel }}</span>
        <span v-else-if="lowStock" class="font-medium text-red-500">{{ lowStockLabel }}</span>
      </p>
    </div>

    <!-- Full -->
    <div v-else class="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
      <div>
        <h3 class="line-clamp-2 text-sm font-semibold leading-snug">{{ name }}</h3>
        <p v-if="subtitle" class="m-0 mt-0.5 line-clamp-1 text-xs text-white/70">{{ subtitle }}</p>
      </div>
      <div class="mt-2 flex items-end justify-between gap-2">
        <span class="text-[17px] font-extrabold leading-none tabular-nums">
          <span class="mr-0.5 text-[11px] font-semibold text-white/70">RM</span>{{ price }}
        </span>
        <span v-if="soldOut" class="text-[11px] font-semibold text-white/70">{{ stockLabel }}</span>
        <span v-else-if="badge" class="rounded-md bg-white px-1.5 py-1 text-[11px] font-extrabold leading-none text-red-600 shadow-sm">{{ badge }}</span>
        <span v-else-if="lowStock" class="text-[11px] font-bold text-amber-200">{{ lowStockLabel }}</span>
        <span v-else-if="stockLabel" class="truncate text-[11px] text-white/60">{{ stockLabel }}</span>
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
  compact?: boolean;
}>();
</script>

<style scoped>
/*
 * Colour recipe (works in light AND dark themes, so no theme selectors are needed):
 * the card is always a deep shade of the icon's colour with white text. A neutral slate card shows first and the
 * coloured layer fades in over it once the icon colour is known. Only transform/opacity animate.
 */
.row {
  --h: var(--hue, #64748b);
  --deep: color-mix(in oklab, var(--h) 38%, #070a12);
  --mid: color-mix(in oklab, var(--h) 62%, #070a12);
  -webkit-tap-highlight-color: transparent;
}
.row img {
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
}

/* ---------- full ---------- */
.row-full {
  isolation: isolate;
  background: linear-gradient(115deg, #2c3446, #161b27);
  box-shadow: 0 10px 22px -16px rgb(8 12 24 / 0.7);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.row-full::before,
.row-full::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
.row-full::before {
  z-index: -1;
  background:
    radial-gradient(90% 150% at 0% 0%, rgb(255 255 255 / 0.2), transparent 62%),
    linear-gradient(115deg, var(--mid), var(--deep));
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.14);
  opacity: 0;
  transition: opacity 0.7s ease;
}
.row-full.has-hue::before {
  opacity: 1;
}
.row-full::after {
  z-index: -2;
  box-shadow: 0 20px 32px -14px color-mix(in oklab, var(--h) 75%, transparent);
  opacity: 0;
  transition: opacity 0.35s ease;
}
.row-full .icon {
  box-shadow: 0 0 0 2px rgb(255 255 255 / 0.28), 0 10px 18px -8px rgb(0 0 0 / 0.55);
}
.row-full.is-sold {
  filter: saturate(0.3) brightness(0.9);
}

/* ---------- compact ---------- */
.row-compact {
  transition: background-color 0.25s ease;
}
.row-compact .icon {
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.06), 0 6px 14px -6px color-mix(in oklab, var(--h) 75%, transparent);
}
.row-compact.is-sold {
  opacity: 0.6;
}

@media (hover: hover) {
  .row-full:hover {
    transform: translateY(-3px);
  }
  .row-full:hover::after {
    opacity: 1;
  }
  .row:hover img {
    transform: scale(1.07);
  }
  .row-compact:hover {
    background-color: color-mix(in oklab, var(--h) 13%, transparent);
  }
}
.row-full:active {
  transform: scale(0.985);
  transition-duration: 0.12s;
}

@media (prefers-reduced-motion: reduce) {
  .row-full,
  .row-full::before,
  .row-full::after,
  .row-compact,
  .row img {
    transition: none;
  }
  .row-full:hover,
  .row-full:active {
    transform: none;
  }
}
</style>
