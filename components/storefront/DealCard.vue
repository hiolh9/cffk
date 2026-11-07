<template>
  <a
    :href="href"
    class="deal group flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-brand"
    :class="hue ? 'has-hue' : ''"
    :style="hue ? { '--hue': hue } : undefined"
  >
    <div class="flex items-center gap-3 p-3">
      <div class="icon size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
        <img
          :src="image"
          :alt="name"
          class="size-full object-cover"
          :class="soldOut ? 'opacity-50 grayscale' : ''"
          loading="lazy"
          width="64"
          height="64"
        />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="line-clamp-1 text-sm font-semibold">{{ name }}</h3>
        <p v-if="subtitle" class="m-0 mt-0.5 line-clamp-1 text-xs text-foreground/65">{{ subtitle }}</p>
      </div>
    </div>

    <div class="mt-auto flex items-center justify-between gap-2 px-3 pb-3">
      <span class="price rounded-lg px-2 py-1 text-[13px] font-bold leading-none tabular-nums">
        <span class="mr-px text-[10px] font-semibold opacity-70">RM</span>{{ price }}
      </span>
      <span v-if="soldOut" class="text-xs font-semibold text-red-500">{{ stockLabel }}</span>
      <span v-else-if="badge" class="rounded-md bg-red-600 px-2 py-1 text-xs font-bold leading-none text-white shadow-sm">{{ badge }}</span>
      <span v-else-if="lowStock" class="text-xs font-semibold text-red-500">{{ lowStockLabel }}</span>
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
/* Same recipe as the list rows: colour wash fades in, hover shadow fades, only transform/opacity animate. */
.deal {
  --h: var(--hue, #94a3b8);
  --base: #ffffff;
  position: relative;
  isolation: isolate;
  border-radius: 1rem;
  background-color: var(--base);
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.2);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
:global(.dark) .deal {
  --base: #141925;
}
.deal::before,
.deal::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
.deal::before {
  z-index: -1;
  background: linear-gradient(125deg, color-mix(in srgb, var(--h) 46%, var(--base)) 0%, color-mix(in srgb, var(--h) 18%, var(--base)) 100%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--h) 45%, transparent);
  opacity: 0;
  transition: opacity 0.7s ease;
}
:global(.dark) .deal::before {
  background: linear-gradient(125deg, color-mix(in srgb, var(--h) 54%, var(--base)) 0%, color-mix(in srgb, var(--h) 22%, var(--base)) 100%);
}
.deal.has-hue::before {
  opacity: 1;
}
.deal::after {
  z-index: -2;
  box-shadow: 0 16px 26px -14px color-mix(in srgb, var(--h) 90%, transparent);
  opacity: 0;
  transition: opacity 0.35s ease;
}
.deal .icon {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.55), 0 8px 16px -8px color-mix(in srgb, var(--h) 90%, #000);
}
:global(.dark) .deal .icon {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18), 0 8px 16px -8px rgba(0, 0, 0, 0.7);
}
.price {
  background: color-mix(in srgb, var(--h) 30%, var(--base));
}
.deal img {
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
@media (hover: hover) {
  .deal:hover {
    transform: translateY(-3px);
  }
  .deal:hover::after {
    opacity: 1;
  }
  .deal:hover img {
    transform: scale(1.06);
  }
}
.deal:active {
  transform: scale(0.985);
  transition-duration: 0.12s;
}
@media (prefers-reduced-motion: reduce) {
  .deal,
  .deal::before,
  .deal::after,
  .deal img {
    transition: none;
  }
  .deal:hover,
  .deal:active {
    transform: none;
  }
}
</style>
