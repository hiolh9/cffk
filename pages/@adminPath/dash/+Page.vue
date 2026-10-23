<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="item in summaryCards" :key="item.label" class="rounded-md border bg-card p-4">
        <p class="text-sm text-muted-foreground">{{ item.label }}</p>
        <p class="mt-2 text-2xl font-semibold tabular-nums">{{ item.value }}</p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-md border bg-card p-4">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">近 14 日趋势</h2>
            <p class="text-sm text-muted-foreground">订单量 / 已付金额（RM）</p>
          </div>
        </div>
        <div class="h-64">
          <VisXYContainer :data="visibleTrend" :margin="{ left: 8, right: 8, top: 12, bottom: 8 }">
            <VisArea
              :x="(d: TrendPoint) => d.i"
              :y="(d: TrendPoint) => d.orders"
              color="var(--color-chart-1)"
              :opacity="0.25"
            />
            <VisArea
              :x="(d: TrendPoint) => d.i"
              :y="(d: TrendPoint) => d.paidRm"
              color="var(--color-chart-2)"
              :opacity="0.2"
            />
            <VisAxis
              type="x"
              :tick-format="(v: number) => visibleTrend[Math.round(v)]?.label ?? ''"
              :num-ticks="Math.min(7, visibleTrend.length)"
            />
            <VisAxis type="y" />
            <ChartTooltip />
            <ChartCrosshair
              :template="tooltipTemplate"
              color="var(--color-chart-1)"
            />
          </VisXYContainer>
        </div>
      </div>

      <div class="rounded-md border bg-card p-4">
        <h2 class="text-base font-semibold">运营快照</h2>
        <ul class="mt-4 grid gap-2 text-sm">
          <li v-for="row in snapshotRows" :key="row.label" class="flex justify-between gap-3 border-b py-2 last:border-0">
            <span class="text-muted-foreground">{{ row.label }}</span>
            <span class="font-medium tabular-nums">{{ row.value }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { defineAsyncComponent } from "vue";
// Async-load chart lib so it is not evaluated at Worker startup (avoids CF 10021 class-extends issues).
const VisArea = defineAsyncComponent(() => import("@unovis/vue").then((m) => m.VisArea));
const VisAxis = defineAsyncComponent(() => import("@unovis/vue").then((m) => m.VisAxis));
const VisXYContainer = defineAsyncComponent(() => import("@unovis/vue").then((m) => m.VisXYContainer));
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import {
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from "@/components/ui/chart";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import { onGetDashboardSummary } from "@/server/ops/dashboard.telefunc";

type TrendPoint = { i: number; label: string; orders: number; paidRm: number };

const loading = ref(true);
const error = ref<string | null>(null);
const summary = ref<Awaited<ReturnType<typeof onGetDashboardSummary>> | null>(null);

const chartConfig = {
  orders: { label: "订单", color: "var(--color-chart-1)" },
  paidRm: { label: "已付(RM)", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

const tooltipTemplate = componentToString(chartConfig, ChartTooltipContent, {
  valueFormatter: (v: number) => String(v),
});

const visibleTrend = computed<TrendPoint[]>(() => {
  const rows = summary.value?.trend ?? [];
  return rows.map((r, i) => ({
    i,
    label: r.date?.slice(5) ?? String(i),
    orders: Number(r.orders ?? 0),
    paidRm: Math.round(Number(r.paidCents ?? 0) / 100),
  }));
});

const summaryCards = computed(() => {
  const s = summary.value;
  if (!s) return [];
  return [
    { label: "今日订单", value: String(s.todayOrders ?? 0) },
    { label: "今日已付(RM)", value: String(Math.round(Number(s.todayPaidCents ?? 0) / 100)) },
    { label: "待发货", value: String(s.pendingDelivery ?? 0) },
    { label: "代充失败(24h)", value: String(s.supplierFail24h ?? 0) },
  ];
});

const snapshotRows = computed(() => {
  const s = summary.value;
  if (!s) return [];
  return [
    { label: "总用户", value: String(s.totalUsers ?? 0) },
    { label: "总商品", value: String(s.totalProducts ?? 0) },
    { label: "待支付订单", value: String(s.pendingPayment ?? 0) },
    { label: "风控拦截(24h)", value: String(s.riskBlocks24h ?? 0) },
  ];
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    summary.value = await runTelefunc(() => onGetDashboardSummary(), { notifyError: false });
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
