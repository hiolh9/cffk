<template>
  <div class="space-y-3 rounded-xl border p-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold">结账自定义输入栏</h3>
        <p class="text-xs text-muted-foreground">
          例如 Game ID、区服、角色名。会显示在商品页，并写入订单供后台与供应商 API。
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" @click="addField">加一栏</Button>
    </div>

    <div
      v-for="(field, index) in fields"
      :key="field._uid"
      class="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2"
    >
      <div class="space-y-1">
        <label class="text-xs">字段 key（英文，给 API 用）</label>
        <Input
          v-model="field.key"
          placeholder="game_uid"
          :class="field.key && !isValidKey(field.key) ? 'border-destructive' : ''"
        />
        <p v-if="field.key && !isValidKey(field.key)" class="text-[11px] text-destructive">
          须为小写英文开头，仅含 a-z、0-9、下划线（如 game_uid）
        </p>
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
      <div class="flex justify-end sm:col-span-2">
        <Button type="button" size="sm" variant="ghost" class="text-destructive" @click="removeField(index)">
          删除
        </Button>
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
import { isValidBuyerFormKey, parseBuyerFormJson, serializeBuyerForm } from "@/lib/buyer-form";

type FieldRow = BuyerFormField & { _uid: string };

const props = defineProps<{ modelValue?: string | null }>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

let uidSeq = 0;
function withUid(f: BuyerFormField): FieldRow {
  return { ...f, _uid: `bf_${++uidSeq}` };
}

const fields = ref<FieldRow[]>(parseBuyerFormJson(props.modelValue).fields.map(withUid));

const isValidKey = isValidBuyerFormKey;

function addField() {
  fields.value.push(
    withUid({
      key: `field_${fields.value.length + 1}`,
      label: "新字段",
      type: "text",
      required: false,
      passToSupplier: true,
      placeholder: "",
    }),
  );
}

function removeField(index: number) {
  fields.value.splice(index, 1);
}

// Emit draft JSON (keeps incomplete keys so the row does not vanish while typing)
watch(
  fields,
  () => {
    const payload = fields.value.map(({ _uid, ...rest }) => rest);
    emit("update:modelValue", serializeBuyerForm({ version: 1, fields: payload }));
  },
  { deep: true },
);

// Only replace local rows when parent loads a meaningfully different definition
// (e.g. product detail fetch) — not on every keystroke echo.
watch(
  () => props.modelValue,
  (v) => {
    const next = parseBuyerFormJson(v).fields;
    const current = fields.value.map(({ _uid, ...rest }) => rest);
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    // Avoid wiping while user is mid-edit: only sync if field count or keys differ a lot
    const nextKeys = next.map((f) => f.key).join("|");
    const curKeys = current.map((f) => f.key).join("|");
    if (next.length === current.length && nextKeys === curKeys) {
      // Same structure — merge labels/types from parent if needed, but keep _uid
      next.forEach((n, i) => {
        if (fields.value[i]) Object.assign(fields.value[i], n);
      });
      return;
    }
    fields.value = next.map(withUid);
  },
);
</script>
