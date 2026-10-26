<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl border bg-card p-4">
        <h2 class="text-sm font-semibold">录入通用日记账 (General Ledger)</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          老板提款、预存款、广告/服务器费用等非订单流水。Owner Drawing / Prepayment 不进 P&amp;L。
        </p>
        <div class="mt-4 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-medium">日期</label>
            <Input v-model="gl.entryDate" type="date" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium">类型</label>
            <select v-model="gl.type" class="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="Expense">Expense（营业费用）</option>
              <option value="Owner_Drawing">Owner Drawing（老板提款）</option>
              <option value="Prepayment">Prepayment（供应商预存款）</option>
              <option value="Capital_Injection">Capital Injection（注资）</option>
              <option value="Asset_Transfer">Asset Transfer</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium">金额 MYR（支出填负数，如 -200）</label>
            <Input v-model.number="gl.amountMyr" type="number" step="0.01" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium">描述</label>
            <Input v-model="gl.description" placeholder="Pay server fee / Owner take money" />
          </div>
          <label class="flex items-center gap-2 text-xs">
            <input v-model="gl.isTaxDeductible" type="checkbox" :disabled="gl.type !== 'Expense'" />
            可税前扣除（仅 Expense；提款/预存款强制否）
          </label>
          <Button :disabled="savingGl" @click="createGl">{{ savingGl ? "保存中..." : "记一笔" }}</Button>
        </div>
      </div>

      <div class="rounded-xl border bg-card p-4">
        <h2 class="text-sm font-semibold">月度 P&amp;L</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          收入/COGS 来自会计销售；费用 = 可抵扣 GL Expense + 结算网关费；汇兑来自结算。
        </p>
        <div class="mt-4 flex flex-wrap items-end gap-2">
          <div class="space-y-1">
            <label class="text-xs font-medium">年月</label>
            <Input v-model="yearMonth" class="w-36" placeholder="2026-10" />
          </div>
          <Button :disabled="running" @click="runPnL">{{ running ? "计算中..." : "生成本月 P&L" }}</Button>
          <Button v-if="csv" variant="outline" @click="downloadCsv">下载 CSV</Button>
        </div>

        <table v-if="pnl" class="mt-4 w-full text-sm">
          <tbody>
            <tr class="border-t"><td class="py-2">Sales Revenue</td><td class="text-right font-medium">{{ fmt(pnl.salesRevenueMyr) }}</td></tr>
            <tr class="border-t"><td class="py-2 text-muted-foreground">Less: COGS</td><td class="text-right">({{ fmt(pnl.cogsMyr) }})</td></tr>
            <tr class="border-t"><td class="py-2 font-medium">Gross Profit</td><td class="text-right font-medium">{{ fmt(pnl.grossProfitMyr) }}</td></tr>
            <tr class="border-t"><td class="py-2 text-muted-foreground">Less: Gateway Fees</td><td class="text-right">({{ fmt(pnl.gatewayFeesMyr) }})</td></tr>
            <tr class="border-t"><td class="py-2 text-muted-foreground">Less: GL Expenses</td><td class="text-right">({{ fmt(pnl.glExpensesMyr) }})</td></tr>
            <tr class="border-t"><td class="py-2 text-muted-foreground">FX Gain/Loss</td><td class="text-right" :class="pnl.realisedFxGainLossMyr >= 0 ? 'text-emerald-600' : 'text-destructive'">{{ fmt(pnl.realisedFxGainLossMyr) }}</td></tr>
            <tr class="border-t border-t-2"><td class="py-2 font-semibold">Net Profit (Form B)</td><td class="text-right font-semibold">{{ fmt(pnl.netProfitMyr) }}</td></tr>
          </tbody>
        </table>

        <div v-if="pnl" class="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <p>不进 P&amp;L：提款 {{ fmt(pnl.excluded.ownerDrawingsMyr) }} · 预存款 {{ fmt(pnl.excluded.prepaymentsMyr) }} · 注资 {{ fmt(pnl.excluded.capitalInjectionMyr) }}</p>
        </div>
      </div>
    </div>

    <div class="rounded-xl border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-sm font-semibold">近期 GL 分录</h2>
        <Button size="sm" variant="outline" :disabled="loading" @click="load">刷新</Button>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-muted-foreground">
          <tr>
            <th class="px-3 py-2">ID</th>
            <th class="px-3 py-2">日期</th>
            <th class="px-3 py-2">类型</th>
            <th class="px-3 py-2">描述</th>
            <th class="px-3 py-2">金额</th>
            <th class="px-3 py-2">可抵扣</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in entries" :key="row.entryId" class="border-t">
            <td class="px-3 py-2 font-mono text-xs">{{ row.entryId }}</td>
            <td class="px-3 py-2">{{ row.entryDate.slice(0, 10) }}</td>
            <td class="px-3 py-2">{{ row.type }}</td>
            <td class="px-3 py-2">{{ row.description }}</td>
            <td class="px-3 py-2">{{ row.amountMyr }}</td>
            <td class="px-3 py-2">{{ row.isTaxDeductible ? "是" : "否" }}</td>
          </tr>
          <tr v-if="!entries.length">
            <td colspan="6" class="px-3 py-8 text-center text-muted-foreground">暂无分录</td>
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
import { Input } from "@/components/ui/input";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import {
  onCreateGlEntry,
  onGenerateMonthlyPnL,
  onListGlEntries,
} from "@/server/accounting/pnl.admin.telefunc";

const loading = ref(false);
const savingGl = ref(false);
const running = ref(false);
const entries = ref<
  Array<{
    entryId: string;
    entryDate: string;
    type: string;
    description: string;
    amountMyr: number;
    isTaxDeductible: boolean;
  }>
>([]);

const yearMonth = ref(new Date().toISOString().slice(0, 7));
const pnl = ref<null | {
  salesRevenueMyr: number;
  cogsMyr: number;
  grossProfitMyr: number;
  gatewayFeesMyr: number;
  glExpensesMyr: number;
  realisedFxGainLossMyr: number;
  netProfitMyr: number;
  excluded: {
    ownerDrawingsMyr: number;
    prepaymentsMyr: number;
    capitalInjectionMyr: number;
  };
}>(null);
const csv = ref("");

const gl = reactive({
  entryDate: new Date().toISOString().slice(0, 10),
  type: "Expense" as const,
  description: "",
  amountMyr: -0,
  isTaxDeductible: true,
});

function fmt(n: number) {
  return Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function load() {
  loading.value = true;
  try {
    const result = await runTelefunc(() => onListGlEntries());
    entries.value = result.items;
  } catch (error) {
    toast.error(userErrorMessage(error, "加载失败"));
  } finally {
    loading.value = false;
  }
}

async function createGl() {
  savingGl.value = true;
  try {
    await runTelefunc(() =>
      onCreateGlEntry({
        entryDate: gl.entryDate,
        type: gl.type,
        description: gl.description,
        amountMyr: Number(gl.amountMyr),
        isTaxDeductible: gl.type === "Expense" ? gl.isTaxDeductible : false,
      }),
    );
    toast.success("已记账");
    gl.description = "";
    await load();
  } catch (error) {
    toast.error(userErrorMessage(error, "记账失败"));
  } finally {
    savingGl.value = false;
  }
}

async function runPnL() {
  running.value = true;
  try {
    const result = await runTelefunc(() =>
      onGenerateMonthlyPnL({ yearMonth: yearMonth.value.trim(), save: true }),
    );
    pnl.value = result.pnl;
    csv.value = result.csv;
    toast.success(`已生成 ${yearMonth.value} P&L`);
  } catch (error) {
    toast.error(userErrorMessage(error, "P&L 生成失败"));
  } finally {
    running.value = false;
  }
}

function downloadCsv() {
  if (!csv.value) return;
  const blob = new Blob([csv.value], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pnl-${yearMonth.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  void load();
});
</script>
