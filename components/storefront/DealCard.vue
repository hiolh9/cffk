<template>
  <a
    :href="href"
    class="deal group flex h-full flex-col overflow-hidden rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-brand"
    :style="hue ? { '--hue': hue } : undefined"
  >
    <div class="flex items-center gap-3 p-3">
      <div class="icon size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
        <img
          :src="image"
          :alt="name"
          class="size-full object-cover transition duration-300 group-hover:scale-105"
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
/* Same colour recipe as the list rows so the page reads as one system. */
.deal {
  --h: var(--hue, #94a3b8);
  --base: #ffffff;
  background: linear-gradient(125deg, color-mix(in srgb, var(--h) 46%, var(--base)) 0%, color-mix(in srgb, var(--h) 18%, var(--base)) 100%);
  border: 1px solid color-mix(in srgb, var(--h) 45%, transparent);
  box-shadow: 0 8px 18px -14px color-mix(in srgb, var(--h) 80%, transparent);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
:global(.dark) .deal {
  --base: #141925;
  background: linear-gradient(125deg, color-mix(in srgb, var(--h) 54%, var(--base)) 0%, color-mix(in srgb, var(--h) 22%, var(--base)) 100%);
}
.deal:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 26px -14px color-mix(in srgb, var(--h) 90%, transparent);
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
@media (prefers-reduced-motion: reduce) {
  .deal, .deal img { transition: none; }
  .deal:hover { transform: none; }
}
</style>
