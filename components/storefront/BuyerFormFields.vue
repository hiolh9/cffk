<template>
  <div v-if="fields.length" class="space-y-3">
    <div v-for="field in fields" :key="field.key" class="space-y-1.5">
      <label class="text-sm font-medium" :for="`bf-${field.key}`">
        {{ field.label }}
        <span v-if="field.required" class="text-destructive">*</span>
      </label>
      <p v-if="field.description" class="text-xs text-muted-foreground">{{ field.description }}</p>
      <textarea
        v-if="field.type === 'textarea'"
        :id="`bf-${field.key}`"
        v-model="model[field.key]"
        rows="3"
        class="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        :placeholder="field.placeholder || field.label"
        :required="field.required"
      />
      <input
        v-else
        :id="`bf-${field.key}`"
        v-model="model[field.key]"
        :type="field.type === 'password' ? 'password' : field.type === 'number' ? 'text' : field.type"
        inputmode="field.type === 'number' ? 'decimal' : undefined"
        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        :placeholder="field.placeholder || field.label"
        :required="field.required"
        autocomplete="off"
      />
      <p v-if="errors[field.key]" class="text-xs text-destructive">{{ errors[field.key] }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import type { BuyerFormField } from "@/lib/buyer-form";

const props = defineProps<{
  fields: BuyerFormField[];
  modelValue?: Record<string, string>;
  errors?: Record<string, string>;
}>();

const emit = defineEmits<{ "update:modelValue": [Record<string, string>] }>();

const model = reactive<Record<string, string>>({ ...(props.modelValue || {}) });

watch(
  model,
  () => {
    emit("update:modelValue", { ...model });
  },
  { deep: true },
);

watch(
  () => props.fields,
  (fields) => {
    for (const f of fields) {
      if (model[f.key] === undefined) model[f.key] = props.modelValue?.[f.key] ?? "";
    }
  },
  { immediate: true },
);
</script>
