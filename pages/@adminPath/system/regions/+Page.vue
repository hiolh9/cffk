<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />
    <div class="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
      <p class="font-medium text-foreground">区域 / 币种 / 支付方式</p>
      <p class="mt-2">
        配置访客所在国家对应的展示币种、是否允许切换、可用支付方式，以及各支付方式的加价规则（覆盖网关手续费）。
        订单仍按<strong class="text-foreground">实收币种 + 金额</strong>入账，会计侧统一折算为 MYR 后再做结算与汇兑。
      </p>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        <li>MY → 强制 MYR；REST/多数国家 → 强制 USD；AU → AUD（可按 JSON 修改）。</li>
        <li>paymentMethods.pricingMode：PASS_THROUGH / ADD_PERCENT（percentBps）/ ADD_FIXED。</li>
        <li>未启用的支付方式 enabled:false，接好网关后再打开。</li>
      </ul>
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
        rows="28"
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
import { DEFAULT_REGIONS_CHECKOUT_CONFIG, parseRegionsCheckoutConfig } from "@/lib/region/config";
import { onGetRegionsConfig, onResetRegionsConfig, onSaveRegionsConfig } from "@/server/region/admin.telefunc";

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const ok = ref(false);
const jsonText = ref(JSON.stringify(DEFAULT_REGIONS_CHECKOUT_CONFIG, null, 2));

async function load() {
  loading.value = true;
  error.value = null;
  ok.value = false;
  try {
    const data = await runTelefunc(() => onGetRegionsConfig(), { notifyError: false });
    jsonText.value = JSON.stringify(data.config, null, 2);
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
    const parsed = JSON.parse(jsonText.value) as unknown;
    const config = parseRegionsCheckoutConfig(JSON.stringify(parsed));
    await runTelefunc(() => onSaveRegionsConfig({ config }), { successMessage: "区域配置已保存" });
    jsonText.value = JSON.stringify(config, null, 2);
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
    ok.value = true;
  } catch (e) {
    error.value = userErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
