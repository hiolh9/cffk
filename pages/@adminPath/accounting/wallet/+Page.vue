<template>
  <main class="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
    <div>
      <h1 class="text-xl font-bold">Supplier prepaid wallet</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Invoice 请自行从邮箱下载。这里只记充值、平台费，并生成对账单 / COGS CSV。
      </p>
    </div>

    <section class="space-y-3 rounded-xl border p-4">
      <h2 class="font-semibold">1. 记录充值 (Top-up)</h2>
      <div class="grid gap-2 sm:grid-cols-2">
        <label class="grid gap-1 text-sm">日期<input v-model="topup.date" type="date" class="h-9 rounded-md border px-2" /></label>
        <label class="grid gap-1 text-sm">金额 MYR<input v-model.number="topup.amount" type="number" step="0.01" class="h-9 rounded-md border px-2" /></label>
        <label class="grid gap-1 text-sm sm:col-span-2">Invoice #<input v-model="topup.invoice" class="h-9 rounded-md border px-2" placeholder="Invoice #12345" /></label>
        <label class="grid gap-1 text-sm">
          供应商
          <select v-model="topup.supplier" class="h-9 rounded-md border bg-background px-2">
            <option v-for="s in supplierOptions" :key="s.key" :value="s.key">
              {{ s.label }} ({{ s.key }})
            </option>
          </select>
        </label>
      </div>
      <button type="button" class="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white" :disabled="busy" @click="saveTopup">保存充值</button>
    </section>

    <section class="space-y-3 rounded-xl border p-4">
      <h2 class="font-semibold">2. 平台 / 会员费 (非 COGS)</h2>
      <div class="grid gap-2 sm:grid-cols-2">
        <label class="grid gap-1 text-sm">日期<input v-model="fee.date" type="date" class="h-9 rounded-md border px-2" /></label>
        <label class="grid gap-1 text-sm">金额 MYR<input v-model.number="fee.amount" type="number" step="0.01" class="h-9 rounded-md border px-2" /></label>
        <label class="grid gap-1 text-sm">
          供应商
          <select v-model="fee.supplier" class="h-9 rounded-md border bg-background px-2">
            <option v-for="s in supplierOptions" :key="s.key" :value="s.key">
              {{ s.label }} ({{ s.key }})
            </option>
          </select>
        </label>
        <label class="grid gap-1 text-sm sm:col-span-2">备注<input v-model="fee.note" class="h-9 rounded-md border px-2" placeholder="Monthly membership" /></label>
      </div>
      <button type="button" class="rounded-lg border px-3 py-2 text-sm font-medium" :disabled="busy" @click="saveFee">保存平台费</button>
    </section>

    <section class="space-y-3 rounded-xl border p-4">
      <h2 class="font-semibold">3. 月度对账单</h2>
      <div class="grid gap-2 sm:grid-cols-3">
        <label class="grid gap-1 text-sm">月份<input v-model="stmt.ym" type="month" class="h-9 rounded-md border px-2" /></label>
        <label class="grid gap-1 text-sm">期初余额<input v-model.number="stmt.opening" type="number" step="0.01" class="h-9 rounded-md border px-2" /></label>
        <label class="grid gap-1 text-sm">
          供应商
          <select v-model="stmt.supplier" class="h-9 rounded-md border bg-background px-2">
            <option v-for="s in supplierOptions" :key="s.key" :value="s.key">
              {{ s.label }} ({{ s.key }})
            </option>
          </select>
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white" :disabled="busy" @click="loadStmt">生成对账单</button>
        <button type="button" class="rounded-lg border px-3 py-2 text-sm font-medium" :disabled="busy" @click="exportCsv">导出 COGS CSV</button>
      </div>
      <pre v-if="stmtText" class="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">{{ stmtText }}</pre>
    </section>
  </main>
</template>

<script lang="ts" setup>
import { reactive, ref, onMounted } from "vue";
import { toast } from "vue-sonner";
import { runTelefunc } from "@/lib/telefunc-client";
import {
  onRecordSupplierTopup,
  onRecordSupplierPlatformFee,
  onGetSupplierWalletStatement,
  onExportSupplierCogsCsv,
} from "@/server/accounting/admin.telefunc";
import { onListSupplierAccounts } from "@/server/supplier/admin.telefunc";

const busy = ref(false);
const stmtText = ref("");

type SupplierOption = { key: string; label: string };
const supplierOptions = ref<SupplierOption[]>([]);

const topup = reactive({ date: new Date().toISOString().slice(0, 10), amount: 0, invoice: "", supplier: "moogold" });
const fee = reactive({ date: new Date().toISOString().slice(0, 10), amount: 0, note: "Monthly membership fee", supplier: "moogold" });
const stmt = reactive({
  ym: new Date().toISOString().slice(0, 7),
  opening: 0,
  supplier: "moogold",
});

async function loadSuppliers() {
  try {
    const res = await runTelefunc(() => onListSupplierAccounts({}));
    const list = 
      (res as { items?: Array<{ provider?: string; name?: string; enabled?: boolean }> })?.items ??
      (res as { accounts?: Array<{ provider?: string; name?: string; enabled?: boolean }> })?.accounts ??
      (Array.isArray(res) ? res : []);

    const map = new Map<string, string>();
    for (const a of list) {
      if (a.enabled === false) continue;
      const key = String(a.provider || "").trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, a.name?.trim() || key);
      }
    }

    if (map.size > 0) {
      supplierOptions.value = [...map.entries()].map(([key, label]) => ({ key, label }));
    } else {
      supplierOptions.value = [{ key: "moogold", label: "MooGold" }];
    }

    // 确保默认选中的 key 在列表内，不在则兜底选第一项
    const firstKey = supplierOptions.value[0].key;
    if (!supplierOptions.value.some(s => s.key === topup.supplier)) topup.supplier = firstKey;
    if (!supplierOptions.value.some(s => s.key === fee.supplier)) fee.supplier = firstKey;
    if (!supplierOptions.value.some(s => s.key === stmt.supplier)) stmt.supplier = firstKey;
  } catch {
    supplierOptions.value = [{ key: "moogold", label: "MooGold" }];
  }
}

onMounted(() => {
  loadSuppliers();
});

async function saveTopup() {
  busy.value = true;
  try {
    await runTelefunc(
      () =>
        onRecordSupplierTopup({
          entryDate: topup.date,
          amountMyr: topup.amount,
          invoiceRef: topup.invoice,
          supplierKey: topup.supplier,
        }),
      { successMessage: "充值已记入 GL (Prepayment)" },
    );
  } finally {
    busy.value = false;
  }
}

async function saveFee() {
  busy.value = true;
  try {
    await runTelefunc(
      () =>
        onRecordSupplierPlatformFee({
          entryDate: fee.date,
          amountMyr: fee.amount,
          supplierKey: fee.supplier,
          description: fee.note,
        }),
      { successMessage: "平台费已记入 GL (Expense)" },
    );
  } finally {
    busy.value = false;
  }
}

async function loadStmt() {
  busy.value = true;
  try {
    const res = await runTelefunc(() =>
      onGetSupplierWalletStatement({
        yearMonth: stmt.ym,
        supplierKey: stmt.supplier,
        openingBalanceMyr: stmt.opening,
      }),
    );
    stmtText.value = (res as { text?: string })?.text || JSON.stringify(res, null, 2);
  } catch {
    /* runTelefunc toasts */
  } finally {
    busy.value = false;
  }
}

async function exportCsv() {
  busy.value = true;
  try {
    const res = (await runTelefunc(() => onExportSupplierCogsCsv({ yearMonth: stmt.ym }))) as {
      csv?: string;
      yearMonth?: string;
    };
    const blob = new Blob([res.csv || ""], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `supplier-cogs-${res.yearMonth || stmt.ym}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("CSV 已下载");
  } finally {
    busy.value = false;
  }
}
</script>
