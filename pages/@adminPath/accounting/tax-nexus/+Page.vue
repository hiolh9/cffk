<template>
  <section class="flex w-full flex-col gap-6 p-4 md:p-6">
    <AdminPageHeader />
    <p class="text-sm text-muted-foreground">
      滚动 12 个月税务国别分流。判定：IP 或发卡国任一为 MY → 本地应税；仅当 IP 与 BIN 均非 MY 且一致时记入他国；否则不记外国区（出口/待补证据）。
    </p>

        <div class="flex flex-wrap gap-2">
      <Button variant="outline" :disabled="loading" @click="load">刷新看板</Button>
      <Input v-model="yearMonth" class="w-36" placeholder="2026-11" />
      <Button variant="outline" :disabled="loading" @click="exportLocal">导出大马本地(全部) CSV</Button>
      <Button variant="outline" :disabled="loading" @click="exportExempt">导出出口免税 CSV</Button>
    </div>

    <div class="flex flex-wrap gap-2 rounded-xl border bg-muted/30 p-3">
      <p class="w-full text-xs text-muted-foreground">
        按商品税务分类（需订单已有 productTaxCategory）：SST 只用 Service；Goods 单独存档。
      </p>
      <Button variant="secondary" :disabled="loading" @click="exportSstService">
        导出 SST服务本地 CSV
      </Button>
      <Button variant="secondary" :disabled="loading" @click="exportDigitalGoods">
        导出数字商品本地 CSV
      </Button>
      <Button variant="secondary" :disabled="loading" @click="exportCategoryExempt">
        导出出口(含分类) CSV
      </Button>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="row in rows"
        :key="row.region"
        class="rounded-xl border bg-card p-4"
      >
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-semibold">{{ row.region }}</h3>
          <span class="text-xs text-muted-foreground">{{ row.taxType || "—" }}</span>
        </div>
        <p class="mt-2 text-2xl font-bold tabular-nums">
          RM {{ formatMyr(row.grossMyrApprox) }}
        </p>
        <p class="text-xs text-muted-foreground">{{ row.orderCount }} 笔（滚动约 12 个月）</p>
        <div v-if="row.thresholdMyr != null" class="mt-3">
          <div class="mb-1 flex justify-between text-xs">
            <span>门槛约 RM {{ formatMyr(row.thresholdMyr) }}</span>
            <span>{{ row.progressPct ?? 0 }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-all"
              :class="(row.progressPct ?? 0) >= 100 ? 'bg-red-500' : 'bg-brand'"
              :style="{ width: Math.min(100, row.progressPct ?? 0) + '%' }"
            />
          </div>
        </div>
        <p v-else class="mt-2 text-xs text-muted-foreground">出口池 / 无固定门槛</p>
      </div>
    </div>

    <div v-if="!loading && !rows.length" class="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      暂无已付订单的国别汇总。请确认下单写入 IP，付款后已跑税务分流。
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runTelefunc } from "@/lib/telefunc-client";
import {
  onGetTaxNexusDashboard,
  onExportMyLocalSalesCsv,
  onExportExemptSalesCsv,
} from "@/server/tax/nexus.admin.telefunc";
import {
  onGetTaxNexusDashboard,
  onExportMyLocalSalesCsv,
  onExportExemptSalesCsv,
  onExportSstLocalServiceCsv,
  onExportDigitalGoodsLocalCsv,
  onExportCategoryExemptCsv,
} from "@/server/tax/nexus.admin.telefunc";
type Row = {
  region: string;
  grossMyrApprox: number;
  orderCount: number;
  thresholdMyr: number | null;
  taxType: string | null;
  progressPct: number | null;
};

const loading = ref(false);
const rows = ref<Row[]>([]);
const yearMonth = ref(new Date().toISOString().slice(0, 7));

function formatMyr(n: number) {
  return (Number(n) || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function load() {
  loading.value = true;
  try {
    const res = await runTelefunc(() => onGetTaxNexusDashboard());
    rows.value = (res as { rows: Row[] }).rows || [];
  } catch {
    /* toast via runTelefunc */
  } finally {
    loading.value = false;
  }
}

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportLocal() {
  const res = (await runTelefunc(() => onExportMyLocalSalesCsv({ yearMonth: yearMonth.value }))) as { csv?: string };
  download(`my-local-sales-${yearMonth.value}.csv`, res.csv || "");
  toast.success("已导出大马本地销售");
}

async function exportExempt() {
  const res = (await runTelefunc(() => onExportExemptSalesCsv({ yearMonth: yearMonth.value }))) as { csv?: string };
  download(`export-exempt-${yearMonth.value}.csv`, res.csv || "");
  toast.success("已导出出口免税证明");
}
async function exportSstService() {
  const ym = yearMonth.value.trim();
  const res = (await runTelefunc(() => onExportSstLocalServiceCsv({ yearMonth: ym }))) as { csv?: string };
  download(`sst-local-service-${ym}.csv`, res.csv || "");
  toast.success("已导出 SST 服务本地（Digital_Service + MY）");
}

async function exportDigitalGoods() {
  const ym = yearMonth.value.trim();
  const res = (await runTelefunc(() => onExportDigitalGoodsLocalCsv({ yearMonth: ym }))) as { csv?: string };
  download(`digital-goods-local-${ym}.csv`, res.csv || "");
  toast.success("已导出数字商品本地（Digital_Goods + MY）");
}

async function exportCategoryExempt() {
  const ym = yearMonth.value.trim();
  const res = (await runTelefunc(() => onExportCategoryExemptCsv({ yearMonth: ym }))) as { csv?: string };
  download(`export-with-category-${ym}.csv`, res.csv || "");
  toast.success("已导出出口订单（含商品税务分类）");
}
onMounted(load);
</script>
