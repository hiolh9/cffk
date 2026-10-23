<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card v-for="metric in metrics" :key="metric.label" class="gap-0">
        <CardHeader class="pb-0">
          <CardDescription>{{ metric.label }}</CardDescription>
          <CardTitle class="text-2xl font-semibold tabular-nums">{{ metric.value }}</CardTitle>
        </CardHeader>
        <CardFooter class="pt-1.5 text-sm text-muted-foreground">{{ metric.description }}</CardFooter>
      </Card>
    </div>

    <Card>
      <CardHeader class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1.5">
          <CardTitle>订单趋势</CardTitle>
          <CardDescription>按店铺时区统计新建与已支付订单。</CardDescription>
        </div>
        <ButtonGroup aria-label="选择统计周期">
          <Button
            v-for="option in rangeOptions"
            :key="option.days"
            size="sm"
            :variant="selectedRange === option.days ? 'secondary' : 'outline'"
            :aria-pressed="selectedRange === option.days"
            @click="selectedRange = option.days"
          >
            {{ option.label }}
          </Button>
        </ButtonGroup>
      </CardHeader>
      <CardContent>
        <ChartContainer :config="chartConfig" class="aspect-auto h-72 w-full">
          <VisXYContainer :data="chartData" :margin="{ top: 10, right: 10, bottom: 24, left: 36 }">
            <VisArea
              :x="(d: any, i: number) => i"
              :y0="0"
              :y="(d: any) => d.created"
              color="var(--color-created)"
              :opacity="0.35"
            />
            <VisArea
              :x="(d: any, i: number) => i"
              :y0="0"
              :y="(d: any) => d.paid"
              color="var(--color-paid)"
              :opacity="0.45"
            />
            <VisAxis type="x" :tick-format="(i: number) => chartData[i]?.label ?? ''" />
            <VisAxis type="y" />
            <ChartTooltip />
            <ChartCrosshair color="var(--color-paid)" />
          </VisXYContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  </section>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { useData } from "vike-vue/useData";
import { defineAsyncComponent } from "vue";
const VisArea = defineAsyncComponent(() => import("@unovis/vue").then((m) => m.VisArea));
const VisAxis = defineAsyncComponent(() => import("@unovis/vue").then((m) => m.VisAxis));
const VisXYContainer = defineAsyncComponent(() => import("@unovis/vue").then((m) => m.VisXYContainer));
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDashboardTrendDate, type DashboardOrderTrendPoint, type DashboardTrendRange } from "@/lib/dashboard-trend";
import { useSiteTimezone } from "@/lib/site-timezone";
import type { Data } from "./+data.server";

const data = useData<Data>();
const { timezone } = useSiteTimezone();
const rangeOptions: { days: DashboardTrendRange; label: string }[] = [
  { days: 7, label: "7 天" },
  { days: 14, label: "14 天" },
  { days: 30, label: "30 天" },
];
const selectedRange = ref<DashboardTrendRange>(14);

const chartConfig = {
  created: { label: "新建", color: "hsl(var(--chart-1))" },
  paid: { label: "已支付", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const metrics = computed(() => data.metrics ?? []);
const chartData = computed(() => {
  const trend: DashboardOrderTrendPoint[] = data.trends?.[selectedRange.value] ?? data.trend ?? [];
  return trend.map((point) => ({
    label: formatDashboardTrendDate(point.date, timezone.value),
    created: point.createdCount ?? point.created ?? 0,
    paid: point.paidCount ?? point.paid ?? 0,
  }));
});
</script>
