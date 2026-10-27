<template>
  <div class="space-y-3 rounded-xl border p-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold">结账自定义输入栏</h3>
        <p class="text-xs text-muted-foreground">例如 Game ID、区服、角色名。会显示在商品页，并写入订单供后台与供应商 API。</p>
      </div>
      <Button type="button" size="sm" variant="outline" @click="addField">加一栏</Button>
    </div>

    <div v-for="(field, index) in fields" :key="index" class="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
      <div class="space-y-1">
        <label class="text-xs">字段 key（英文，给 API 用）</label>
        <Input v-model="field.key" placeholder="game_uid" />
      </div>
      <div class="space-y-1">
        <label class="text-xs">显示名称</label>
        <Input v-model="field.label" placeholder="游戏账号 ID" />
      </div>
      <div class="space-y-1">
        <label class="text-xs">类型</label>
        <select v-model="field.type" class="flex h-9 w-full rounded-md border bg-background px-2 text-sm">
          <option value="text">文本</option>
          <option value="email">邮箱</option>
          <option value="number">数字</option>
          <option value="textarea">多行</option>
          <option value="password">密码（脱敏展示）</option>
        </select>
      </div>
      <div class="space-y-1">
        <label class="text-xs">占位提示</label>
        <Input v-model="field.placeholder" placeholder="请输入…" />
      </div>
      <label class="flex items-center gap-2 text-xs">
        <input v-model="field.required" type="checkbox" />
        必填
      </label>
      <label class="flex items-center gap-2 text-xs">
        <input v-model="field.passToSupplier" type="checkbox" />
        传给供应商 API
      </label>
      <div class="sm:col-span-2 flex justify-end">
        <Button type="button" size="sm" variant="ghost" class="text-destructive" @click="fields.splice(index, 1)">删除</Button>
      </div>
    </div>

    <p v-if="!fields.length" class="text-xs text-muted-foreground">未配置时仅使用默认联系方式 / 备注。</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BuyerFormField } from "@/lib/buyer-form";
import { parseBuyerFormJson, serializeBuyerForm } from "@/lib/buyer-form";

const props = defineProps<{ modelValue?: string | null }>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

const fields = ref<BuyerFormField[]>(parseBuyerFormJson(props.modelValue).fields);

function addField() {
  fields.value.push({
    key: `field_${fields.value.length + 1}`,
    label: "新字段",
    type: "text",
    required: true,
    passToSupplier: true,
  });
}

watch(
  fields,
  () => {
    emit("update:modelValue", serializeBuyerForm({ version: 1, fields: fields.value }));
  },
  { deep: true },
);

watch(
  () => props.modelValue,
  (v) => {
    const next = parseBuyerFormJson(v).fields;
    if (JSON.stringify(next) !== JSON.stringify(fields.value)) fields.value = next;
  },
);
</script>
