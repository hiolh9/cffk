<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />
    <div class="flex flex-wrap items-end gap-3">
      <div class="grid gap-1">
        <Label>开始日期</Label>
        <Input v-model="startDate" type="date" class="h-9 w-40" />
      </div>
      <div class="grid gap-1">
        <Label>结束日期</Label>
        <Input v-model="endDate" type="date" class="h-9 w-40" />
      </div>
      <div class="grid gap-1">
        <Label>搜索</Label>
        <Input v-model="query" class="h-9 w-56" placeholder="订单号 / 发票号 / 邮箱" @keyup.enter="load" />
      </div>
      <Button variant="outline" :disabled="loading" @click="load">查询</Button>
      <Button variant="outline" :disabled="exporting" @click="exportCsv">{{ exporting ? "导出中..." : "导出 CSV" }}</Button>
      <Button @click="manualOpen = true">手动开单（银行转账）</Button>
    </div>

    <div class="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
      <p>收入按 <strong class="text-foreground">Gross（全额）</strong> 记账；手续费单独记费用。银行直转订单 Fee 强制为 0。</p>
      <p>预存款扣款记入 COGS（来自供应商采购成本）。订单不删除，仅变更状态；关键操作写入审计日志。</p>
      <p>Root / 管理员下单与前台订单同一履约链路：供应商商品会调用上游 API 发货。</p>
    </div>

    <AdminDataTable :columns="columns" :rows="rows" row-key="orderId" empty-text="暂无账本记录。">
      <template #cell-grossAmountCents="{ row }">{{ money(row.grossAmountCents) }}</template>
      <template #cell-feeAmountCents="{ row }">{{ money(row.feeAmountCents) }}</template>
      <template #cell-netReceivedCents="{ row }">{{ money(row.netReceivedCents) }}</template>
      <template #cell-cogsCostCents="{ row }">{{ money(row.cogsCostCents) }}</template>
      <template #pagination>
        <Pagination :total="total" :page="page" :page-size="pageSize" :page-size-options="[20, 50, 100]" @update:page="changePage" @update:page-size="changePageSize" />
      </template>
    </AdminDataTable>

    <Dialog v-model:open="manualOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>手动开单（银行直转）</DialogTitle>
          <DialogDescription>手续费强制为 0。保存后标记已支付并自动履约（含供应商 API）。</DialogDescription>
        </DialogHeader>
        <div class="grid gap-3">
          <div class="grid gap-1">
            <Label>SKU ID</Label>
            <Input v-model.number="manual.productSkuId" type="number" min="1" />
          </div>
          <div class="grid gap-1">
            <Label>数量</Label>
            <Input v-model.number="manual.quantity" type="number" min="1" max="100" />
          </div>
          <div class="grid gap-1">
            <Label>客户邮箱</Label>
            <Input v-model="manual.customerEmail" type="email" />
          </div>
          <div class="grid gap-1">
            <Label>金额（可选）</Label>
            <Input v-model.number="manual.grossAmount" type="number" step="0.01" min="0" placeholder="留空用商品价" />
          </div>
          <div class="grid gap-1">
            <Label>备注</Label>
            <Input v-model="manual.note" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="manualOpen = false">取消</Button>
          <Button :disabled="saving" @click="createManual">{{ saving ? "开单中..." : "确认开单并发货" }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import AdminDataTable, { type AdminTableColumn } from "@/components/admin/AdminDataTable.vue";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Pagination from "@/components/ui/pagination/Pagination.vue";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { runTelefunc } from "@/lib/telefunc-client";
import { onCreateManualBankOrder, onExportAccountingCsv, onListAccountingLedger } from "@/server/accounting/admin.telefunc";

type Row = Awaited<ReturnType<typeof onListAccountingLedger>>["rows"][number];

const columns: AdminTableColumn<Row>[] = [
  { key: "orderNo", label: "Order_ID" },
  { key: "invoiceNo", label: "Invoice" },
  { key: "date", label: "Date" },
  { key: "customerEmail", label: "Email" },
  { key: "paymentMethod", label: "Method" },
  { key: "grossAmountCents", label: "Gross" },
  { key: "feeAmountCents", label: "Fee" },
  { key: "netReceivedCents", label: "Net" },
  { key: "cogsCostCents", label: "COGS" },
  { key: "status", label: "Status" },
];

const rows = ref<Row[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const loading = ref(false);
const exporting = ref(false);
const startDate = ref("");
const endDate = ref("");
const query = ref("");
const manualOpen = ref(false);
const saving = ref(false);
const manual = reactive({ productSkuId: 0, quantity: 1, customerEmail: "", grossAmount: undefined as number | undefined, note: "" });

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

async function load() {
  loading.value = true;
  try {
    const data = await runTelefunc(
      () =>
        onListAccountingLedger({
          startDate: startDate.value ? `${startDate.value}T00:00:00.000Z` : undefined,
          endDate: endDate.value ? `${endDate.value}T23:59:59.999Z` : undefined,
          query: query.value || undefined,
          page: page.value,
          pageSize: pageSize.value,
        }),
      { errorMessage: "读取账本失败" },
    );
    rows.value = data.rows;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function changePage(p: number) {
  page.value = p;
  void load();
}
function changePageSize(s: number) {
  pageSize.value = s;
  page.value = 1;
  void load();
}

async function exportCsv() {
  exporting.value = true;
  try {
    const data = await runTelefunc(
      () =>
        onExportAccountingCsv({
          startDate: startDate.value ? `${startDate.value}T00:00:00.000Z` : undefined,
          endDate: endDate.value ? `${endDate.value}T23:59:59.999Z` : undefined,
          query: query.value || undefined,
        }),
      { successMessage: "CSV 已生成" },
    );
    const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    exporting.value = false;
  }
}

async function createManual() {
  saving.value = true;
  try {
    await runTelefunc(
      () =>
        onCreateManualBankOrder({
          productSkuId: manual.productSkuId,
          quantity: manual.quantity,
          customerEmail: manual.customerEmail,
          grossAmount: manual.grossAmount,
          note: manual.note || undefined,
        }),
      { successMessage: "手动开单成功，已触发履约" },
    );
    manualOpen.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
