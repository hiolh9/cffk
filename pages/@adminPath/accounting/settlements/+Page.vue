<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />

    <div class="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" :disabled="backfilling" @click="backfill">
        {{ backfilling ? "回填中..." : "回填已支付订单到会计账" }}
      </Button>
      <Button size="sm" variant="outline" @click="exportCsv('sales')">导出销售 CSV</Button>
      <Button size="sm" variant="outline" @click="exportCsv('settlements')">导出结算 CSV</Button>
      <Button size="sm" variant="outline" @click="exportCsv('adjustments')">导出退款调整 CSV</Button>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl border bg-card p-4">
        <h2 class="text-sm font-semibold">录入网关结算（MYR）</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          只勾选 Success 且未结算订单。退款/作废订单不会出现在此列表。
        </p>
        <div class="mt-4 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-medium">到账日期</label>
            <Input v-model="form.settlementDate" type="date" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-medium">银行实收 MYR</label>
              <Input v-model.number="form.bankReceivedMyr" type="number" step="0.01" min="0" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium">网关手续费 MYR</label>
              <Input v-model.number="form.gatewayFeeMyr" type="number" step="0.01" min="0" />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium">备注</label>
            <Input v-model="form.notes" placeholder="可选" />
          </div>
          <p class="text-xs text-muted-foreground">
            已选 {{ selectedIds.length }} 笔 · Gross {{ previewGross.toFixed(2) }} · Realised FX
            {{ previewRealised.toFixed(2) }}
          </p>
          <Button :disabled="saving || !selectedIds.length" @click="createSettlement">
            {{ saving ? "提交中..." : "创建结算" }}
          </Button>
        </div>
      </div>

      <div class="rounded-xl border bg-card p-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold">汇率（月均 → MYR）</h2>
          <Button size="sm" variant="outline" :disabled="syncingFx" @click="syncFx">
            {{ syncingFx ? "同步中..." : "同步上月 BNM" }}
          </Button>
        </div>
        <div class="mt-3 max-h-48 overflow-auto text-xs">
          <table class="w-full">
            <thead class="text-left text-muted-foreground">
              <tr>
                <th class="py-1">年月</th>
                <th>币种</th>
                <th>汇率</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in fxRates" :key="`${r.yearMonth}-${r.currency}`" class="border-t">
                <td class="py-1">{{ r.yearMonth }}</td>
                <td>{{ r.currency }}</td>
                <td>{{ r.rateToMyr }}</td>
                <td>{{ r.source }}</td>
              </tr>
              <tr v-if="!fxRates.length">
                <td colspan="4" class="py-6 text-center text-muted-foreground">暂无汇率</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 space-y-2 border-t pt-3">
          <Input v-model="manualYm" placeholder="2026-09" class="h-8" />
          <Textarea v-model="manualRatesJson" rows="2" class="font-mono text-xs" placeholder='{"USD":4.72,"SGD":3.50}' />
          <Button size="sm" variant="secondary" :disabled="savingFx" @click="saveManualFx">保存汇率</Button>
        </div>
      </div>
    </div>

    <div class="rounded-xl border bg-card p-4">
      <h2 class="text-sm font-semibold">退款 / 作废（会计）</h2>
      <p class="mt-1 text-xs text-muted-foreground">
        未结算：仅改状态，不再进结算。已结算：写调整分录（冲减收入 + 银行流出），不删历史结算。
      </p>
      <div class="mt-3 grid gap-3 md:grid-cols-4">
        <Input v-model="refundForm.orderId" placeholder="Order_ID / INV-..." class="md:col-span-2" />
        <Input v-model.number="refundForm.revenueReversalMyr" type="number" step="0.01" min="0" placeholder="冲减收入 MYR（空=全额）" />
        <Input v-model.number="refundForm.bankImpactMyr" type="number" step="0.01" min="0" placeholder="银行流出 MYR（空=同上）" />
        <Input v-model="refundForm.note" placeholder="备注" class="md:col-span-2" />
        <Button size="sm" variant="destructive" :disabled="refunding" @click="doRefund('REFUND')">退款</Button>
        <Button size="sm" variant="outline" :disabled="refunding" @click="doRefund('VOID')">作废</Button>
      </div>
    </div>

    <div class="rounded-xl border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-sm font-semibold">未结算会计订单</h2>
        <Button size="sm" variant="outline" :disabled="loading" @click="load">刷新</Button>
      </div>
      <div class="max-h-96 overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th class="px-3 py-2"></th>
              <th class="px-3 py-2">Order_ID</th>
              <th class="px-3 py-2">日期</th>
              <th class="px-3 py-2">币种</th>
              <th class="px-3 py-2">原币</th>
              <th class="px-3 py-2">汇率</th>
              <th class="px-3 py-2">Revenue MYR</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in unsettled" :key="row.orderId" class="border-t">
              <td class="px-3 py-2">
                <input v-model="selectedIds" type="checkbox" :value="row.orderId" />
              </td>
              <td class="px-3 py-2 font-mono text-xs">{{ row.orderId }}</td>
              <td class="px-3 py-2 text-xs">{{ row.transactionDate.slice(0, 10) }}</td>
              <td class="px-3 py-2">{{ row.originalCurrency }}</td>
              <td class="px-3 py-2">{{ row.originalAmount }}</td>
              <td class="px-3 py-2">{{ row.transactionFxRate }}</td>
              <td class="px-3 py-2 font-medium">{{ row.revenueMyr }}</td>
            </tr>
            <tr v-if="!unsettled.length">
              <td colspan="7" class="px-3 py-10 text-center text-muted-foreground">没有未结算订单</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl border bg-card">
        <div class="border-b px-4 py-3 text-sm font-semibold">近期结算</div>
        <table class="w-full text-sm">
          <thead class="text-left text-muted-foreground">
            <tr>
              <th class="px-3 py-2">ID</th>
              <th class="px-3 py-2">日期</th>
              <th class="px-3 py-2">Bank</th>
              <th class="px-3 py-2">FX</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in settlements" :key="s.settlementId" class="border-t">
              <td class="px-3 py-2 font-mono text-xs">{{ s.settlementId }}</td>
              <td class="px-3 py-2">{{ s.settlementDate.slice(0, 10) }}</td>
              <td class="px-3 py-2">{{ s.bankReceivedMyr }}</td>
              <td class="px-3 py-2" :class="s.realisedFxGainLoss >= 0 ? 'text-emerald-600' : 'text-destructive'">
                {{ s.realisedFxGainLoss }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rounded-xl border bg-card">
        <div class="border-b px-4 py-3 text-sm font-semibold">退款 / 作废调整</div>
        <table class="w-full text-sm">
          <thead class="text-left text-muted-foreground">
            <tr>
              <th class="px-3 py-2">Order</th>
              <th class="px-3 py-2">类型</th>
              <th class="px-3 py-2">冲收入</th>
              <th class="px-3 py-2">银行</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in adjustments" :key="a.id" class="border-t">
              <td class="px-3 py-2 font-mono text-xs">{{ a.orderId }}</td>
              <td class="px-3 py-2">{{ a.type }}</td>
              <td class="px-3 py-2">{{ a.revenueReversalMyr }}</td>
              <td class="px-3 py-2">{{ a.bankImpactMyr }}</td>
            </tr>
            <tr v-if="!adjustments.length">
              <td colspan="4" class="px-3 py-8 text-center text-muted-foreground">暂无调整</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { toast } from "vue-sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import {
  onBackfillAcctSales,
  onCreateAcctSettlement,
  onExportAcctAdjustmentsCsv,
  onExportAcctSalesCsv,
  onExportAcctSettlementsCsv,
  onListAcctAdjustments,
  onListAcctSettlements,
  onListFxRates,
  onListUnsettledAcctSales,
  onMarkAcctSaleRefundOrVoid,
  onSyncBnmFxRates,
  onUpsertFxRates,
} from "@/server/accounting/settlement.admin.telefunc";

type SaleRow = {
  orderId: string;
  transactionDate: string;
  originalCurrency: string;
  originalAmount: number;
  transactionFxRate: number;
  revenueMyr: number;
};

const unsettled = ref<SaleRow[]>([]);
const settlements = ref<
  Array<{
    settlementId: string;
    settlementDate: string;
    grossOrdersMyrTotal: number;
    gatewayFeeMyr: number;
    bankReceivedMyr: number;
    realisedFxGainLoss: number;
  }>
>([]);
const adjustments = ref<
  Array<{ id: number; orderId: string; type: string; revenueReversalMyr: number; bankImpactMyr: number }>
>([]);
const fxRates = ref<Array<{ yearMonth: string; currency: string; rateToMyr: number; source: string }>>([]);
const selectedIds = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const syncingFx = ref(false);
const savingFx = ref(false);
const backfilling = ref(false);
const refunding = ref(false);
const manualYm = ref("");
const manualRatesJson = ref('{"USD":4.72}');

const form = reactive({
  settlementDate: new Date().toISOString().slice(0, 10),
  bankReceivedMyr: 0,
  gatewayFeeMyr: 0,
  notes: "",
});

const refundForm = reactive({
  orderId: "",
  revenueReversalMyr: undefined as number | undefined,
  bankImpactMyr: undefined as number | undefined,
  note: "",
});

const previewGross = computed(() =>
  unsettled.value.filter((r) => selectedIds.value.includes(r.orderId)).reduce((s, r) => s + Number(r.revenueMyr), 0),
);
const previewRealised = computed(
  () => Number(form.bankReceivedMyr || 0) + Number(form.gatewayFeeMyr || 0) - previewGross.value,
);

function monthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

async function load() {
  loading.value = true;
  try {
    const [a, b, c, d] = await Promise.all([
      runTelefunc(() => onListUnsettledAcctSales()),
      runTelefunc(() => onListAcctSettlements()),
      runTelefunc(() => onListFxRates()),
      runTelefunc(() => onListAcctAdjustments()),
    ]);
    unsettled.value = a.items as SaleRow[];
    settlements.value = b.items;
    fxRates.value = c.items;
    adjustments.value = d.items;
  } catch (error) {
    toast.error(userErrorMessage(error, "加载失败"));
  } finally {
    loading.value = false;
  }
}

async function createSettlement() {
  saving.value = true;
  try {
    const result = await runTelefunc(() =>
      onCreateAcctSettlement({
        settlementDate: form.settlementDate,
        bankReceivedMyr: Number(form.bankReceivedMyr),
        gatewayFeeMyr: Number(form.gatewayFeeMyr),
        orderIds: selectedIds.value,
        notes: form.notes || undefined,
      }),
    );
    toast.success(`已创建 ${result.settlementId}`);
    selectedIds.value = [];
    await load();
  } catch (error) {
    toast.error(userErrorMessage(error, "创建结算失败"));
  } finally {
    saving.value = false;
  }
}

async function doRefund(type: "REFUND" | "VOID") {
  if (!refundForm.orderId.trim()) {
    toast.error("请填写 Order_ID");
    return;
  }
  refunding.value = true;
  try {
    const result = await runTelefunc(() =>
      onMarkAcctSaleRefundOrVoid({
        orderId: refundForm.orderId.trim(),
        type,
        revenueReversalMyr: refundForm.revenueReversalMyr,
        bankImpactMyr: refundForm.bankImpactMyr,
        note: refundForm.note || undefined,
      }),
    );
    toast.success(
      result.wasSettled
        ? `${type} 完成（已结算，已记调整）`
        : `${type} 完成（未结算，仅改状态）`,
    );
    refundForm.orderId = "";
    await load();
  } catch (error) {
    toast.error(userErrorMessage(error, "操作失败"));
  } finally {
    refunding.value = false;
  }
}

async function backfill() {
  backfilling.value = true;
  try {
    const result = await runTelefunc(() => onBackfillAcctSales());
    toast.success(`扫描 ${result.scanned}，新建 ${result.created}，跳过 ${result.skipped}，失败 ${result.failed}`);
    await load();
  } catch (error) {
    toast.error(userErrorMessage(error, "回填失败"));
  } finally {
    backfilling.value = false;
  }
}

async function exportCsv(kind: "sales" | "settlements" | "adjustments") {
  try {
    const range = monthRange();
    const result =
      kind === "sales"
        ? await runTelefunc(() => onExportAcctSalesCsv(range))
        : kind === "settlements"
          ? await runTelefunc(() => onExportAcctSettlementsCsv(range))
          : await runTelefunc(() => onExportAcctAdjustmentsCsv(range));
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acct-${kind}-${range.startDate.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.error(userErrorMessage(error, "导出失败"));
  }
}

async function syncFx() {
  syncingFx.value = true;
  try {
    const result = await runTelefunc(() => onSyncBnmFxRates());
    toast.success(`已同步 ${result.yearMonth}，${result.stored} 个币种`);
    await load();
  } catch (error) {
    toast.error(userErrorMessage(error, "BNM 同步失败"));
  } finally {
    syncingFx.value = false;
  }
}

async function saveManualFx() {
  savingFx.value = true;
  try {
    const rates = JSON.parse(manualRatesJson.value) as Record<string, number>;
    await runTelefunc(() => onUpsertFxRates({ yearMonth: manualYm.value.trim(), rates }));
    toast.success("汇率已保存");
    await load();
  } catch (error) {
    toast.error(userErrorMessage(error, "保存汇率失败"));
  } finally {
    savingFx.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>
