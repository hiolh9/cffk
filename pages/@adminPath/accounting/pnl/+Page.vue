<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl border bg-card p-4">
        <h2 class="text-sm font-semibold">录入通用日记账 (General Ledger)</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          广告费、域名、公司邮箱、SST、WHT、服务器费等都可以记。选对<strong>类型</strong>：营业费用用
          Expense；老板个人拿钱用 Owner Drawing（不进 P&L）；打给供应商预存用 Prepayment（资产，不进当月费用）。
        </p>

        <div class="mt-3 flex flex-wrap gap-1.5">
          <button
            v-for="preset in expensePresets"
            :key="preset.label"
            type="button"
            class="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-medium hover:border-brand hover:bg-brand-soft hover:text-brand"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div class="mt-4 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-medium">日期</label>
            <Input v-model="gl.entryDate" type="date" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium">类型</label>
            <select v-model="gl.type" class="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="Expense">Expense（营业费用：广告/域名/邮箱/SST/WHT/服务器）</option>
              <option value="Owner_Drawing">Owner Drawing（老板提款，不进 P&L）</option>
              <option value="Prepayment">Prepayment（供应商预存款，资产）</option>
              <option value="Capital_Injection">Capital Injection（注资）</option>
              <option value="Asset_Transfer">Asset Transfer（资产划转）</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium">金额 MYR（支出填负数，如 -200）</label>
            <Input v-model.number="gl.amountMyr" type="number" step="0.01" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium">描述</label>
            <Input v-model="gl.description" placeholder="Facebook ads Oct / Domain renew / SST payment" />
          </div>
          <label class="flex items-center gap-2 text-xs">
            <input v-model="gl.isTaxDeductible" type="checkbox" :disabled="gl.type !== 'Expense'" />
            可税前扣除（仅 Expense；提款/预存款强制否。SST/WHT 一般勾选并在描述写清税种）
          </label>
          <Button :disabled="savingGl" @click="createGl">{{ savingGl ? "保存中..." : "记一笔" }}</Button>
        </div>
      </div>

      <div class="rounded-xl border bg-card p-4">
        <h2 class="text-sm font-semibold">月度 P&L 与一键归档</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          收入/COGS 来自会计销售；费用 = 可抵扣 GL Expense + 网关费。一键导出规范文件名全表 CSV。
        </p>
        <div class="mt-4 flex flex-wrap items-end gap-2">
          <div class="space-y-1">
            <label class="text-xs font-medium">年月</label>
            <Input v-model="yearMonth" class="w-36" placeholder="2026-10" />
          </div>
          <Button :disabled="running" @click="runPnL">{{ running ? "计算中..." : "生成本月 P&L" }}</Button>
          <Button v-if="csv" variant="outline" @click="downloadCsv">下载 P&L CSV</Button>
          <Button :disabled="exporting" variant="secondary" @click="exportPack">
            {{ exporting ? "打包中..." : "一键导出当月全表" }}
          </Button>
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
          <p>不进 P&L：提款 {{ fmt(pnl.excluded.ownerDrawingsMyr) }} · 预存款 {{ fmt(pnl.excluded.prepaymentsMyr) }} · 注资 {{ fmt(pnl.excluded.capitalInjectionMyr) }}</p>
        </div>
        <p v-if="lastExportNote" class="mt-2 text-xs text-muted-foreground">{{ lastExportNote }}</p>
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
  onExportMonthlyPack,
  onGenerateMonthlyPnL,
  onListGlEntries,
} from "@/server/accounting/pnl.admin.telefunc";

const loading = ref(false);
const savingGl = ref(false);
const running = ref(false);
const exporting = ref(false);
const lastExportNote = ref("");
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
  type: "Expense" as
    | "Expense"
    | "Owner_Drawing"
    | "Prepayment"
    | "Capital_Injection"
    | "Asset_Transfer",
  description: "",
  amountMyr: 0,
  isTaxDeductible: true,
});

/** Quick-fill common business costs (all as Expense + tax-deductible by default). */
const expensePresets = [
  { label: "广告费", description: "Advertising / Meta / Google ads", type: "Expense" as const, deductible: true },
  { label: "域名", description: "Domain registration / renewal", type: "Expense" as const, deductible: true },
  { label: "公司邮箱", description: "Business email / Google Workspace", type: "Expense" as const, deductible: true },
  { label: "服务器/托管", description: "Server / Cloudflare / hosting", type: "Expense" as const, deductible: true },
  { label: "SST", description: "SST payment (service tax)", type: "Expense" as const, deductible: true },
  { label: "WHT", description: "Withholding tax payment", type: "Expense" as const, deductible: true },
  { label: "供应商预存", description: "Supplier prepayment top-up", type: "Prepayment" as const, deductible: false },
  { label: "老板提款", description: "Owner drawing", type: "Owner_Drawing" as const, deductible: false },
];

function applyPreset(preset: (typeof expensePresets)[number]) {
  gl.type = preset.type;
  gl.description = preset.description;
  gl.isTaxDeductible = preset.deductible;
  if (gl.amountMyr === 0) gl.amountMyr = -0;
  toast.message(`已填：${preset.label}（请改金额后点「记一笔」）`);
}

function fmt(n: number) {
  return Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  downloadText(`pnl-${yearMonth.value}.csv`, csv.value);
}

async function exportPack() {
  exporting.value = true;
  try {
    const pack = await runTelefunc(() => onExportMonthlyPack({ yearMonth: yearMonth.value.trim() }));
    for (const file of pack.files) {
      const mime = file.filename.endsWith(".txt") ? "text/plain;charset=utf-8" : "text/csv;charset=utf-8";
      downloadText(file.filename, file.content, mime);
      await new Promise((r) => setTimeout(r, 150));
    }
    lastExportNote.value = `已导出 ${pack.files.length} 个文件（Sparkpay-${pack.yearMonth}-*.csv）`;
    toast.success(lastExportNote.value);
  } catch (error) {
    toast.error(userErrorMessage(error, "导出失败"));
  } finally {
    exporting.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>
