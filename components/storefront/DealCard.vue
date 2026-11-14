<template>
  <a
    :href="href"
    class="deal group relative flex h-full flex-col gap-3.5 rounded-3xl p-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    :class="[hue ? 'has-hue' : '', soldOut ? 'is-sold' : '']"
    :style="hue ? { '--hue': hue } : undefined"
  >
    <span class="art" aria-hidden="true"><img :src="image" alt="" /></span>
    <span class="sheen" aria-hidden="true"><i /></span>
    <div class="flex items-center gap-3.5">
      <div class="icon size-[76px] shrink-0 overflow-hidden rounded-[20px] bg-black/20">
        <img
          :src="image"
          :alt="name"
          class="size-full object-cover"
          :class="soldOut ? 'opacity-60 grayscale' : ''"
          loading="lazy"
          width="76"
          height="76"
        />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="line-clamp-2 text-[15px] font-bold leading-snug">{{ name }}</h3>
        <p v-if="subtitle" class="m-0 mt-1 line-clamp-1 text-xs text-white/70">{{ subtitle }}</p>
      </div>
    </div>

    <div class="mt-auto">
      <div class="flex items-end justify-between gap-2">
        <span class="text-[26px] font-black leading-none tabular-nums">
          <span class="mr-0.5 text-sm font-semibold text-white/70">RM</span>{{ price }}
        </span>
        <span v-if="soldOut" class="text-xs font-semibold text-white/70">{{ stockLabel }}</span>
        <span v-else-if="badge" class="rounded-lg bg-white px-2 py-1 text-[13px] font-extrabold leading-none text-red-600 shadow-sm">{{ badge }}</span>
      </div>

      <div v-if="lowStock && !soldOut" class="mt-3 flex items-center gap-2">
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
          <div class="h-full rounded-full bg-amber-300" :style="{ width: Math.max(12, ((stock ?? 0) / 20) * 100) + '%' }" />
        </div>
        <span class="shrink-0 text-[11px] font-bold text-amber-200">{{ lowStockLabel }}</span>
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
/* Same recipe as the product rows, a step richer: deep icon-coloured card, white text, colour fades in. */
.deal {
  --h: var(--hue, #64748b);
  --deep: color-mix(in oklab, var(--h) 34%, #070a12);
  --mid: color-mix(in oklab, var(--h) 68%, #070a12);
  isolation: isolate;
  background: linear-gradient(125deg, #2c3446, #161b27);
  box-shadow: 0 14px 28px -18px rgb(8 12 24 / 0.75);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
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
  background:
    radial-gradient(80% 110% at 0% 0%, rgb(255 255 255 / 0.24), transparent 60%),
    linear-gradient(125deg, var(--mid), var(--deep));
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16);
  opacity: 0;
  transition: opacity 0.7s ease;
}
.deal.has-hue::before {
  opacity: 1;
}
.deal::after {
  z-index: -2;
  box-shadow: 0 24px 36px -16px color-mix(in oklab, var(--h) 80%, transparent);
  opacity: 0;
  transition: opacity 0.35s ease;
}
.deal .icon {
  box-shadow: 0 0 0 2px rgb(255 255 255 / 0.3), 0 12px 20px -8px rgb(0 0 0 / 0.55);
}
.deal img {
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
}
.deal.is-sold {
  filter: saturate(0.3) brightness(0.9);
}
@media (hover: hover) {
  .deal:hover {
    transform: translateY(-4px);
  }
  .deal:hover::after {
    opacity: 1;
  }
  .deal:hover .icon img {
    transform: scale(1.07);
  }
}
/* Blurred copy of the game icon glows behind the card: gives every card its own texture and keeps working
   even when the icon colour cannot be read. Fades out toward the text. */
.art {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  opacity: 0.5;
  -webkit-mask-image: linear-gradient(90deg, #000 0%, transparent 80%);
  mask-image: linear-gradient(90deg, #000 0%, transparent 80%);
}
.art img {
  position: absolute;
  left: -8%;
  top: -35%;
  width: 62%;
  height: 170%;
  max-width: none;
  object-fit: cover;
  filter: blur(18px) saturate(1.7);
  transform: scale(1.15);
}
/* One light sweep on hover; transform only. */
.sheen {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
}
.sheen i {
  position: absolute;
  top: -20%;
  bottom: -20%;
  left: 0;
  width: 36%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / 0.2), transparent);
  transform: translateX(-150%) skewX(-18deg);
}
@media (hover: hover) {
    .deal:hover .sheen i {
    transform: translateX(400%) skewX(-18deg);
    transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1);
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
  .sheen {
    display: none;
  }
}
</style>
