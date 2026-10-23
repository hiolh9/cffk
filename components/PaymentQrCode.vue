<template>
  <img
    v-if="value"
    :src="qrSrc"
    width="224"
    height="224"
    class="mx-auto rounded-md bg-white p-2"
    alt="付款二维码"
  />
</template>

<script lang="ts" setup>
import { computed } from "vue";

const props = defineProps<{ value: string }>();

const qrSrc = computed(() => {
  const data = encodeURIComponent(props.value || "");
  return `https://api.qrserver.com/v1/create-qr-code/?size=224x224&margin=8&data=${data}`;
});
</script>
