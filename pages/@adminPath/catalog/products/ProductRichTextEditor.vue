<template>
  <div class="grid gap-2">
    <Textarea
      :model-value="modelValue"
      :rows="12"
      class="min-h-48 font-mono text-sm"
      placeholder="商品详情（支持 HTML；富文本编辑器暂时简化为文本框以保障部署稳定）"
      @update:model-value="onInput"
    />
    <p class="text-xs text-muted-foreground">提示：可粘贴 HTML。完整所见即所得编辑器将在部署稳定后恢复。</p>
  </div>
</template>

<script lang="ts" setup>
import { Textarea } from "@/components/ui/textarea";

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function onInput(value: string | number) {
  emit("update:modelValue", String(value ?? ""));
}
</script>
