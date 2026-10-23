<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />

    <Alert v-if="loadError" variant="destructive">
      <AlertTitle>风控看板加载失败</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center gap-3">
        <span>{{ loadError }}</span>
        <Button size="sm" variant="outline" :disabled="loading" @click="load">重试</Button>
      </AlertDescription>
    </Alert>

    <div v-if="data" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div class="rounded-lg border bg-card p-4">
        <p class="text-sm text-muted-foreground">跟踪用户（最近分数）</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">{{ data.summary.trackedUsers }}</p>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <p class="text-sm text-muted-foreground">达到审核分 (≥{{ data.thresholds.behaviorScoreReview }})</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-amber-600">{{ data.summary.highRisk }}</p>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <p class="text-sm text-muted-foreground">达到拦截分 (≥{{ data.thresholds.behaviorScoreBlock }})</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-destructive">{{ data.summary.blockedBand }}</p>
      </div>
    </div>

    <div v-if="data" class="rounded-lg border bg-muted/30 p-4 text-sm">
      <p class="font-medium">当前行为分阈值（在「站点设置」中修改）</p>
      <p class="mt-2 text-muted-foreground">
        窗口 {{ data.thresholds.behaviorWindowHours }}h ·
        每用户最多设备 {{ data.thresholds.maxDevicesPerUser }} ·
        每用户最多 IP {{ data.thresholds.maxIpsPerUser }} ·
        审核分 {{ data.thresholds.behaviorScoreReview }} ·
        拦截分 {{ data.thresholds.behaviorScoreBlock }}
      </p>
      <Button as-child size="sm" variant="outline" class="mt-3">
        <a :href="settingsHref">去站点设置调整</a>
      </Button>
    </div>

    <section class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-lg border">
        <div class="border-b px-4 py-3"><h2 class="font-semibold">高风险用户（行为分）</h2></div>
        <div class="max-h-96 overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-muted/80 text-left">
              <tr>
                <th class="px-3 py-2 font-medium">用户 ID</th>
                <th class="px-3 py-2 font-medium">分数</th>
                <th class="px-3 py-2 font-medium">原因</th>
                <th class="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data?.scores ?? []" :key="row.userId" class="border-t">
                <td class="px-3 py-2 font-mono text-xs">{{ shortId(row.userId) }}</td>
                <td class="px-3 py-2 tabular-nums" :class="scoreClass(row.score)">{{ row.score }}</td>
                <td class="px-3 py-2 text-xs text-muted-foreground">{{ formatReasons(row.reasonsJson) }}</td>
                <td class="px-3 py-2">
                  <Button size="sm" variant="outline" class="h-7 text-xs" @click="ban('USER', row.userId)">拉黑用户</Button>
                </td>
              </tr>
              <tr v-if="!(data?.scores?.length)">
                <td colspan="4" class="px-3 py-6 text-center text-muted-foreground">暂无行为分记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-lg border">
        <div class="border-b px-4 py-3"><h2 class="font-semibold">共享硬指纹</h2></div>
        <div class="max-h-96 overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-muted/80 text-left">
              <tr>
                <th class="px-3 py-2 font-medium">指纹</th>
                <th class="px-3 py-2 font-medium">账号数</th>
                <th class="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data?.sharedFp ?? []" :key="String(row.fpHash)" class="border-t">
                <td class="px-3 py-2 font-mono text-xs">{{ shortId(String(row.fpHash), 12) }}</td>
                <td class="px-3 py-2 tabular-nums">{{ row.userCount }}</td>
                <td class="px-3 py-2">
                  <Button size="sm" variant="outline" class="h-7 text-xs" @click="ban('FP', String(row.fpHash))">拉黑指纹</Button>
                </td>
              </tr>
              <tr v-if="!(data?.sharedFp?.length)">
                <td colspan="3" class="px-3 py-6 text-center text-muted-foreground">暂无共享指纹</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="rounded-lg border">
      <div class="border-b px-4 py-3"><h2 class="font-semibold">最近设备观测</h2></div>
      <div class="max-h-80 overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-muted/80 text-left">
            <tr>
              <th class="px-3 py-2 font-medium">用户</th>
              <th class="px-3 py-2 font-medium">设备</th>
              <th class="px-3 py-2 font-medium">指纹</th>
              <th class="px-3 py-2 font-medium">IP</th>
              <th class="px-3 py-2 font-medium">次数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data?.sightings ?? []" :key="row.id" class="border-t">
              <td class="px-3 py-2 font-mono text-xs">{{ shortId(row.userId) }}</td>
              <td class="px-3 py-2 font-mono text-xs">{{ shortId(row.deviceId) }}</td>
              <td class="px-3 py-2 font-mono text-xs">{{ row.fpHash ? shortId(row.fpHash, 10) : "—" }}</td>
              <td class="px-3 py-2 font-mono text-xs">{{ row.clientIp || "—" }}</td>
              <td class="px-3 py-2 tabular-nums">{{ row.sightingCount }}</td>
            </tr>
            <tr v-if="!(data?.sightings?.length)">
              <td colspan="5" class="px-3 py-6 text-center text-muted-foreground">暂无观测记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="rounded-lg border">
      <div class="border-b px-4 py-3">
        <h2 class="font-semibold">黑名单</h2>
        <p class="text-xs text-muted-foreground">IP / USER / DEVICE / FP（硬指纹）</p>
      </div>
      <form class="grid gap-3 border-b p-4 md:grid-cols-4" @submit.prevent="addBlacklist">
        <select v-model="blKind" class="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="IP">IP</option>
          <option value="USER">USER</option>
          <option value="DEVICE">DEVICE</option>
          <option value="FP">FP</option>
        </select>
        <Input v-model="blValue" placeholder="值" />
        <Input v-model="blReason" placeholder="原因（可选）" />
        <Button type="submit" :disabled="blSaving">添加</Button>
      </form>
      <div class="max-h-64 overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-muted/80 text-left">
            <tr>
              <th class="px-3 py-2 font-medium">类型</th>
              <th class="px-3 py-2 font-medium">值</th>
              <th class="px-3 py-2 font-medium">原因</th>
              <th class="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data?.blacklist ?? []" :key="row.id" class="border-t">
              <td class="px-3 py-2">{{ row.kind }}</td>
              <td class="px-3 py-2 font-mono text-xs">{{ shortId(row.value, 20) }}</td>
              <td class="px-3 py-2 text-xs text-muted-foreground">{{ row.reason || "—" }}</td>
              <td class="px-3 py-2">
                <Button size="sm" variant="ghost" class="h-7 text-xs" @click="removeBl(row.id)">移除</Button>
              </td>
            </tr>
            <tr v-if="!(data?.blacklist?.length)">
              <td colspan="4" class="px-3 py-6 text-center text-muted-foreground">黑名单为空</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import {
  onDisableRiskBlacklist,
  onGetRiskDashboard,
  onUpsertRiskBlacklist,
} from "@/server/ops/risk-admin.telefunc";
import { usePageContext } from "vike-vue/usePageContext";

type Dashboard = Awaited<ReturnType<typeof onGetRiskDashboard>>;

const pageContext = usePageContext();
const basePath = computed(() => `/${pageContext.routeParams.adminPath}`);
const settingsHref = computed(() => `${basePath.value}/system/settings`);

const loading = ref(false);
const loadError = ref<string | null>(null);
const data = ref<Dashboard | null>(null);

const blKind = ref<"IP" | "USER" | "DEVICE" | "FP">("IP");
const blValue = ref("");
const blReason = ref("");
const blSaving = ref(false);

function shortId(value: string, n = 10) {
  if (!value) return "—";
  return value.length <= n ? value : `${value.slice(0, n)}…`;
}

function formatReasons(raw: string | null) {
  if (!raw) return "—";
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.join(", ") : String(raw);
  } catch {
    return String(raw);
  }
}

function scoreClass(score: number) {
  if (!data.value) return "";
  if (score >= data.value.thresholds.behaviorScoreBlock) return "text-destructive font-semibold";
  if (score >= data.value.thresholds.behaviorScoreReview) return "text-amber-600 font-semibold";
  return "";
}

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    data.value = await runTelefunc(() => onGetRiskDashboard(), { notifyError: false });
  } catch (cause) {
    loadError.value = userErrorMessage(cause);
  } finally {
    loading.value = false;
  }
}

async function ban(kind: "USER" | "DEVICE" | "FP" | "IP", value: string) {
  try {
    await runTelefunc(
      () => onUpsertRiskBlacklist({ kind, value, reason: "admin dashboard" }),
      { successMessage: "已加入黑名单" },
    );
    await load();
  } catch {
    /* toast handled */
  }
}

async function addBlacklist() {
  if (!blValue.value.trim()) {
    toast.error("请填写黑名单值");
    return;
  }
  blSaving.value = true;
  try {
    await runTelefunc(
      () =>
        onUpsertRiskBlacklist({
          kind: blKind.value,
          value: blValue.value.trim(),
          reason: blReason.value.trim() || null,
        }),
      { successMessage: "已添加黑名单" },
    );
    blValue.value = "";
    blReason.value = "";
    await load();
  } catch {
    /* handled */
  } finally {
    blSaving.value = false;
  }
}

async function removeBl(id: number) {
  try {
    await runTelefunc(() => onDisableRiskBlacklist({ id }), { successMessage: "已移除" });
    await load();
  } catch {
    /* handled */
  }
}

onMounted(load);
</script>
