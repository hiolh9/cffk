<template>
  <section class="flex flex-col gap-6 p-4 md:p-6">
    <AdminPageHeader />
    <p class="text-sm text-muted-foreground">
      税种管理、未报义务、按 % 估算税额、生成申报批次。到期日默认 = 最久一笔未报义务日期 + 税种「期后天数」。
    </p>

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" :disabled="loading" @click="load">刷新</Button>
      <Button @click="showTypeForm = !showTypeForm">{{ showTypeForm ? "收起税种表单" : "新建/编辑税种" }}</Button>
    </div>

    <div v-if="showTypeForm" class="rounded-xl border bg-card p-4 grid gap-3 md:grid-cols-2">
      <label class="text-sm">代码 <input v-model="typeForm.code" class="mt-1 w-full rounded border px-2 py-1" placeholder="SST" /></label>
      <label class="text-sm">名称 <input v-model="typeForm.name" class="mt-1 w-full rounded border px-2 py-1" placeholder="Service Tax" /></label>
      <label class="text-sm">默认税率 % <input v-model.number="typeForm.defaultRatePercent" type="number" step="0.01" class="mt-1 w-full rounded border px-2 py-1" /></label>
      <label class="text-sm">期后到期天数 <input v-model.number="typeForm.dueDaysAfterPeriodEnd" type="number" class="mt-1 w-full rounded border px-2 py-1" /></label>
      <label class="text-sm md:col-span-2">提醒（天，逗号分隔） <input v-model="typeForm.reminderDaysBefore" class="mt-1 w-full rounded border px-2 py-1" placeholder="14,7,3,1" /></label>
      <label class="text-sm md:col-span-2">说明 <input v-model="typeForm.description" class="mt-1 w-full rounded border px-2 py-1" /></label>
      <div class="md:col-span-2">
        <Button :disabled="savingType" @click="saveType">{{ savingType ? "保存中…" : "保存税种" }}</Button>
      </div>
    </div>

    <div class="overflow-x-auto rounded-xl border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left">
          <tr>
            <th class="p-2">税种</th>
            <th class="p-2">默认%</th>
            <th class="p-2">未报笔数</th>
            <th class="p-2">最久未报(天)</th>
            <th class="p-2">建议到期</th>
            <th class="p-2">未报税基 MYR</th>
            <th class="p-2">估算税额 MYR</th>
            <th class="p-2">提醒</th>
            <th class="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in dashboard" :key="row.id" class="border-t">
            <td class="p-2 font-medium">{{ row.code }} · {{ row.name }}</td>
            <td class="p-2">{{ row.defaultRatePercent }}%</td>
            <td class="p-2">{{ row.openCount }}</td>
            <td class="p-2">{{ row.daysSinceOldestOpen ?? "—" }}</td>
            <td class="p-2">{{ row.suggestedDueDate ? fmtDate(row.suggestedDueDate) : "—" }}</td>
            <td class="p-2 text-right">{{ fmt(row.openTaxableBaseMyr) }}</td>
            <td class="p-2 text-right font-medium">{{ fmt(row.openTaxAmountMyr) }}</td>
            <td class="p-2">
              <span v-if="row.reminderDue" class="text-amber-600 font-medium">需提醒</span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="p-2">
              <Button size="sm" variant="outline" @click="prepareBatch(row)">生成本月批次</Button>
            </td>
          </tr>
          <tr v-if="!dashboard.length">
            <td colspan="9" class="p-4 text-muted-foreground">暂无税种。请先新建或确认已跑 0023 SQL。</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="batchForm.taxTypeId" class="rounded-xl border bg-card p-4 grid gap-3 md:grid-cols-3">
      <div class="md:col-span-3 text-sm font-medium">生成申报批次 · 税种 ID {{ batchForm.taxTypeId }}</div>
      <label class="text-sm">月份 YYYY-MM <input v-model="batchForm.yearMonth" class="mt-1 w-full rounded border px-2 py-1" /></label>
      <label class="text-sm">税率 %（可改） <input v-model.number="batchForm.ratePercent" type="number" step="0.01" class="mt-1 w-full rounded border px-2 py-1" /></label>
      <div class="flex items-end">
        <Button :disabled="creatingBatch" @click="createBatch">{{ creatingBatch ? "生成中…" : "从 Open 义务生成 Draft" }}</Button>
      </div>
      <p v-if="lastBatch" class="md:col-span-3 text-sm text-muted-foreground">
        已生成 {{ lastBatch.batchId }} · 订单 {{ lastBatch.orderCount }} · 税基 {{ fmt(lastBatch.taxableBaseMyr) }} · 税额
        {{ fmt(lastBatch.taxAmountMyr) }}（{{ lastBatch.ratePercentUsed }}%）
      </p>
    </div>

    <div class="overflow-x-auto rounded-xl border">
      <div class="p-2 text-sm font-medium border-b">最近申报批次</div>
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left">
          <tr>
            <th class="p-2">批次 ID</th>
            <th class="p-2">状态</th>
            <th class="p-2">税率</th>
            <th class="p-2">税基</th>
            <th class="p-2">税额</th>
            <th class="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in batches" :key="b.id" class="border-t">
            <td class="p-2 font-mono text-xs">{{ b.id }}</td>
            <td class="p-2">{{ b.status }}</td>
            <td class="p-2">{{ b.ratePercentUsed }}%</td>
            <td class="p-2 text-right">{{ fmt(b.taxableBaseMyr) }}</td>
            <td class="p-2 text-right">{{ fmt(b.taxAmountMyr) }}</td>
            <td class="p-2">
              <Button
                v-if="b.status === 'Draft' || b.status === 'Ready'"
                size="sm"
                variant="outline"
                @click="markFiled(b.id)"
              >
                标记已申报
              </Button>
            </td>
          </tr>
          <tr v-if="!batches.length">
            <td colspan="6" class="p-4 text-muted-foreground">暂无批次</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { toast } from "vue-sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Button } from "@/components/ui/button";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import {
  onTaxDashboard,
  onUpsertTaxType,
  onCreateTaxBatch,
  onListTaxBatches,
  onMarkTaxBatchFiled,
} from "@/server/accounting/tax.admin.telefunc";

const loading = ref(false);
const savingType = ref(false);
const creatingBatch = ref(false);
const showTypeForm = ref(false);
const dashboard = ref<any[]>([]);
const batches = ref<any[]>([]);
const lastBatch = ref<any>(null);

const typeForm = reactive({
  code: "SST",
  name: "Service Tax",
  description: "",
  defaultRatePercent: 6,
  dueDaysAfterPeriodEnd: 30,
  reminderDaysBefore: "14,7,3,1",
});

const batchForm = reactive({
  taxTypeId: 0,
  yearMonth: new Date().toISOString().slice(0, 7),
  ratePercent: 6,
});

function fmt(n: number) {
  return Number(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

async function load() {
  loading.value = true;
  try {
    const [d, b] = await Promise.all([
      runTelefunc(() => onTaxDashboard()),
      runTelefunc(() => onListTaxBatches()),
    ]);
    dashboard.value = d.items ?? [];
    batches.value = b.items ?? [];
  } catch (e) {
    toast.error(userErrorMessage(e, "加载失败"));
  } finally {
    loading.value = false;
  }
}

async function saveType() {
  savingType.value = true;
  try {
    await runTelefunc(() =>
      onUpsertTaxType({
        code: typeForm.code,
        name: typeForm.name,
        description: typeForm.description,
        defaultRatePercent: typeForm.defaultRatePercent,
        dueDaysAfterPeriodEnd: typeForm.dueDaysAfterPeriodEnd,
        reminderDaysBefore: typeForm.reminderDaysBefore,
      }),
    );
    toast.success("税种已保存");
    showTypeForm.value = false;
    await load();
  } catch (e) {
    toast.error(userErrorMessage(e, "保存失败"));
  } finally {
    savingType.value = false;
  }
}

function prepareBatch(row: any) {
  batchForm.taxTypeId = row.id;
  batchForm.ratePercent = Number(row.defaultRatePercent) || 0;
  batchForm.yearMonth = new Date().toISOString().slice(0, 7);
}

async function createBatch() {
  if (!batchForm.taxTypeId) return;
  creatingBatch.value = true;
  try {
    lastBatch.value = await runTelefunc(() =>
      onCreateTaxBatch({
        taxTypeId: batchForm.taxTypeId,
        yearMonth: batchForm.yearMonth,
        ratePercent: batchForm.ratePercent,
      }),
    );
    toast.success("批次已生成");
    await load();
  } catch (e) {
    toast.error(userErrorMessage(e, "生成失败"));
  } finally {
    creatingBatch.value = false;
  }
}

async function markFiled(batchId: string) {
  try {
    await runTelefunc(() => onMarkTaxBatchFiled({ batchId }));
    toast.success("已标记 Filed");
    await load();
  } catch (e) {
    toast.error(userErrorMessage(e, "操作失败"));
  }
}

onMounted(() => {
  void load();
});
</script>
