<template>
  <main class="mx-auto max-w-3xl p-4">
    <h1 class="text-xl font-bold">{{ data.name }}</h1>
    <p v-if="data.subtitle" class="text-muted-foreground">{{ data.subtitle }}</p>
    <p class="mt-2 text-lg font-semibold tabular-nums">RM{{ selectedSku?.price }}</p>
    <div class="mt-4 flex flex-wrap gap-2">
      <button
        v-for="sku in data.skus"
        :key="sku.id"
        type="button"
        class="rounded border px-3 py-2 text-sm"
        :class="String(sku.id) === selectedSkuId ? 'border-primary bg-primary/10' : ''"
        @click="selectedSkuId = String(sku.id)"
      >
        {{ sku.name }} · RM{{ sku.price }}
      </button>
    </div>
    <p class="mt-6 text-sm text-muted-foreground">Checkout UI temporarily simplified while fixing SSR order. Full page restoring next.</p>
  </main>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useData } from "vike-vue/useData";
import type { Data } from "./+data.server";

const data = useData<Data>();
const selectedSkuId = ref(String(data.skus?.[0]?.id ?? ""));
const selectedSku = computed(() => data.skus?.find((s) => String(s.id) === selectedSkuId.value) ?? data.skus?.[0]);
</script>
