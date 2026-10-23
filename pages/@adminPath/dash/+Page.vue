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
        <div class="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          图表依赖已临时下线（保障部署）。指标卡片仍可用。
        </div>
      </CardContent>
    </Card>
  </section>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { useData } from "vike-vue/useData";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardTrendRange } from "@/lib/dashboard-trend";
import type { Data } from "./+data.server";

const data = useData<Data>();
const rangeOptions: { days: DashboardTrendRange; label: string }[] = [
  { days: 7, label: "7 天" },
  { days: 14, label: "14 天" },
  { days: 30, label: "30 天" },
];
const selectedRange = ref<DashboardTrendRange>(14);
const metrics = computed(() => data.metrics ?? []);
</script>
