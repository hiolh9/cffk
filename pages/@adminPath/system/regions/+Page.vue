<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />
    <div class="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
      <p class="font-medium text-foreground">区域 / 币种 / 支付方式</p>
      <p class="mt-2">
        前台币种下拉由「启用展示币种」控制（JSON 字段 enabledCurrencies）。
        各区域 displayCurrency / allowedCurrencies 决定 IP 默认币种。
        未单独配置的国家走 REST（默认 USD）。
      </p>
      <p class="mt-2">
        区域价：在商品编辑每个 SKU 填写 USD/SGD/AUD 标价；只有切换币种没有区域价时仍显示 MYR。
      </p>
    </div>

    <div class="rounded-xl border bg-card p-4">
      <h2 class="text-sm font-semibold text-foreground">启用展示币种（前台下拉）</h2>
      <p class="mt-1 text-xs text-muted-foreground">取消勾选后前台不再出现该币种。MYR 建议保留。</p>
      <div class="mt-3 flex flex-wrap gap-3">
        <label v-for="code in allCurrencies" :key="code" class="flex items-center gap-2 text-sm">
          <input v-model="enabledSelected" type="checkbox" :value="code" class="size-4" />
          {{ code }}
        </label>
      </div>
      <Button class="mt-3" size="sm" type="button" variant="secondary" :disabled="loading || saving" @click="applyEnabledToJson">
        写入 JSON（再点保存）
      </Button>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button type="button" variant="outline" :disabled="loading" @click="load">重新加载</Button>
      <Button type="button" variant="outline" :disabled="loading" @click="resetDefaults">恢复默认配置</Button>
      <Button type="button" :disabled="loading || saving" @click="save">{{ saving ? "保存中…" : "保存" }}</Button>
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    <p v-if="ok" class="text-sm text-green-600">已保存</p>

    <label class="grid gap-2 text-sm font-medium">
      regionsConfigJson
      <textarea
        v-model="jsonText"
        rows="24"
        class="w-full rounded-lg border bg-background p-3 font-mono text-xs leading-5"
        spellcheck="false"
      />
    </label>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Button } from "@/components/ui/button";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import { STORE_CURRENCIES, type StoreCurrency } from "@/lib/currency";
import { DEFAULT_REGIONS_CHECKOUT_CONFIG, parseRegionsCheckoutConfig } from "@/lib/region/config";
import { onGetRegionsConfig, onResetRegionsConfig, onSaveRegionsConfig } from "@/server/region/admin.telefunc";

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const ok = ref(false);
const jsonText = ref(JSON.stringify(DEFAULT_REGIONS_CHECKOUT_CONFIG, null, 2));
const allCurrencies = STORE_CURRENCIES as readonly StoreCurrency[];
const enabledSelected = ref<StoreCurrency[]>([...(DEFAULT_REGIONS_CHECKOUT_CONFIG.enabledCurrencies || ["MYR", "SGD", "AUD", "USD"])]);

function syncEnabledFromJson() {
  try {
    const parsed = parseRegionsCheckoutConfig(jsonText.value);
    enabledSelected.value = [...(parsed.enabledCurrencies || [])];
  } catch {
    /* ignore */
  }
}

function applyEnabledToJson() {
  try {
    const parsed = JSON.parse(jsonText.value) as Record<string, unknown>;
    const list = enabledSelected.value.filter(Boolean);
    parsed.enabledCurrencies = list.length ? list : ["MYR"];
    jsonText.value = JSON.stringify(parsed, null, 2);
    ok.value = false;
  } catch {
    error.value = "JSON 格式错误，无法写入启用币种";
  }
}

async function load() {
  loading.value = true;
  error.value = null;
  ok.value = false;
  try {
    const data = await runTelefunc(() => onGetRegionsConfig(), { notifyError: false });
    jsonText.value = JSON.stringify(data.config, null, 2);
    syncEnabledFromJson();
  } catch (e) {
    error.value = userErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = null;
  ok.value = false;
  try {
    applyEnabledToJson();
    const parsed = JSON.parse(jsonText.value) as unknown;
    const config = parseRegionsCheckoutConfig(JSON.stringify(parsed));
    await runTelefunc(() => onSaveRegionsConfig({ config }), { successMessage: "区域配置已保存" });
    jsonText.value = JSON.stringify(config, null, 2);
    syncEnabledFromJson();
    ok.value = true;
  } catch (e) {
    error.value = e instanceof SyntaxError ? "JSON 格式错误" : userErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

async function resetDefaults() {
  saving.value = true;
  error.value = null;
  try {
    const data = await runTelefunc(() => onResetRegionsConfig(), { successMessage: "已恢复默认" });
    jsonText.value = JSON.stringify(data.config, null, 2);
    syncEnabledFromJson();
    ok.value = true;
  } catch (e) {
    error.value = userErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
