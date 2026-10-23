<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />

    <Alert v-if="loadError" variant="destructive">
      <AlertTitle>安全配置加载失败</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center gap-3">
        <span>{{ loadError }}</span>
        <Button size="sm" variant="outline" :disabled="statusLoading" @click="loadStatus({ initial: true })">重试</Button>
      </AlertDescription>
    </Alert>

    <div class="grid gap-8 border-t pt-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
      <nav class="flex gap-1 overflow-x-auto lg:flex-col" aria-label="安全配置">
        <button
          v-for="item in sections"
          :key="item.value"
          type="button"
          class="shrink-0 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
          :class="activeSection === item.value ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'"
          :aria-pressed="activeSection === item.value"
          @click="activeSection = item.value"
        >
          {{ item.label }}
        </button>
      </nav>

      <div v-if="status" class="min-w-0">
        <section v-if="activeSection === 'two-factor'" aria-labelledby="two-factor-title" class="grid gap-6">
          <div>
            <h2 id="two-factor-title" class="text-xl font-semibold tracking-normal">双重认证</h2>
            <p class="mt-1 text-sm text-muted-foreground">启用后，管理员使用邮箱和密码登录时还必须提供验证器 App 的验证码。</p>
          </div>

          <Alert :class="status.twoFactorEnabled ? undefined : 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400'">
            <ShieldCheckIcon v-if="status.twoFactorEnabled" class="size-4" />
            <ShieldAlertIcon v-else class="size-4" />
            <AlertTitle>{{ status.twoFactorEnabled ? "双重认证已启用" : "双重认证未启用" }}</AlertTitle>
            <AlertDescription :class="status.twoFactorEnabled ? undefined : 'text-orange-600 dark:text-orange-400'">
              {{ status.twoFactorEnabled ? "登录时需要 TOTP 验证码。" : "建议立即启用，降低账号被盗风险。" }}
            </AlertDescription>
          </Alert>

          <div v-if="!status.twoFactorEnabled" class="grid gap-4">
            <div class="flex flex-wrap gap-2">
              <Button :disabled="loading" @click="startTwoFactorSetup">{{ loading ? "准备中..." : "开始配置" }}</Button>
            </div>
            <div v-if="setup" class="grid max-w-md gap-4 rounded-md border p-4">
              <p class="text-sm text-muted-foreground">使用验证器 App 扫描二维码，或手动输入密钥：<code class="rounded bg-muted px-1">{{ setup.secret }}</code></p>
              <img v-if="setup.qrCode" :src="setup.qrCode" alt="TOTP QR" class="mx-auto size-48 rounded-md border bg-white p-2" />
              <div class="grid gap-2">
                <Label for="totp-code">验证码</Label>
                <Input id="totp-code" v-model="totpCode" inputmode="numeric" autocomplete="one-time-code" />
              </div>
              <Button :disabled="loading || !totpCode" @click="verifyTwoFactor">{{ loading ? "验证中..." : "确认并启用" }}</Button>
              <div v-if="backupCodes.length" class="rounded-md border bg-muted/40 p-3 text-xs">
                <p class="mb-2 font-medium">备份码（请妥善保存）</p>
                <ul class="grid gap-1 font-mono">
                  <li v-for="code in backupCodes" :key="code">{{ code }}</li>
                </ul>
              </div>
            </div>
          </div>

          <div v-else class="grid gap-4">
            <div class="grid max-w-md gap-2">
              <Label for="current-password">当前密码</Label>
              <Input id="current-password" v-model="currentPassword" type="password" autocomplete="current-password" />
            </div>
            <Button variant="destructive" class="w-fit" :disabled="loading || !currentPassword" @click="disableTwoFactor">{{ loading ? "关闭中..." : "关闭双重认证" }}</Button>
          </div>
        </section>

        <section v-else aria-labelledby="turnstile-title" class="grid gap-6">
          <div>
            <h2 id="turnstile-title" class="text-xl font-semibold tracking-normal">Cloudflare Turnstile</h2>
            <p class="mt-1 text-sm text-muted-foreground">为后台邮箱密码登录增加人机验证，降低自动化撞库与爆破风险。</p>
          </div>
          <Alert :class="status.turnstile.enabled ? undefined : 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400'">
            <ShieldCheckIcon v-if="status.turnstile.enabled" class="size-4" />
            <ShieldAlertIcon v-else class="size-4" />
            <AlertTitle>{{ status.turnstile.enabled ? "Turnstile 已启用" : "Turnstile 未完整配置" }}</AlertTitle>
            <AlertDescription :class="status.turnstile.enabled ? undefined : 'text-orange-600 dark:text-orange-400'">
              {{ status.turnstile.enabled ? "后台登录会强制校验 Turnstile 令牌。" : "须同时配置站点 Key 和 Secret Key 才会启用。" }}
            </AlertDescription>
          </Alert>
          <div class="rounded-md border bg-muted/30 p-4 text-sm leading-6">
            <p>在 Cloudflare Dashboard 创建 Turnstile 站点后，将以下变量配置到 Worker：</p>
            <pre class="mt-3 overflow-x-auto rounded bg-background p-3 font-mono text-xs">TURNSTILE_SITE_KEY=前端站点 Key
TURNSTILE_SECRET_KEY=服务端 Secret Key</pre>
            <p class="mt-3 text-muted-foreground">Secret Key 只存放在 Worker Secret 中，页面不会返回其原文。</p>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import { ShieldAlertIcon, ShieldCheckIcon } from "@lucide/vue";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import { onGetSecurityStatus } from "@/server/security/admin.telefunc";

const sections = [
  { value: "two-factor", label: "双重认证" },
  { value: "turnstile", label: "Turnstile" },
] as const;

const activeSection = ref<(typeof sections)[number]["value"]>("two-factor");
const statusLoading = ref(false);
const loadError = ref<string | null>(null);
const loading = ref(false);
const status = ref<Awaited<ReturnType<typeof onGetSecurityStatus>> | null>(null);
const setup = ref<{ secret: string; qrCode: string } | null>(null);
const totpCode = ref("");
const backupCodes = ref<string[]>([]);
const currentPassword = ref("");

async function loadStatus(options?: { initial?: boolean }) {
  statusLoading.value = true;
  loadError.value = null;
  try {
    status.value = await runTelefunc(() => onGetSecurityStatus(), { notifyError: false });
  } catch (cause) {
    loadError.value = userErrorMessage(cause);
    if (!options?.initial) toast.error(loadError.value);
  } finally {
    statusLoading.value = false;
  }
}

async function startTwoFactorSetup() {
  loading.value = true;
  try {
    const result = await authClient.twoFactor.enable({ password: "" as any });
    if (result.error) {
      toast.error(result.error.message || "无法开始 2FA 配置");
      return;
    }
    const secret = result.data?.totpURI?.split("secret=")[1]?.split("&")[0] || result.data?.secret || "";
    setup.value = {
      secret,
      qrCode: await (await import("qrcode")).default.toDataURL(result.data.totpURI, { margin: 1, width: 256 }),
    };
    backupCodes.value = result.data.backupCodes ?? [];
  } catch (cause) {
    toast.error(userErrorMessage(cause));
  } finally {
    loading.value = false;
  }
}

async function verifyTwoFactor() {
  loading.value = true;
  try {
    const result = await authClient.twoFactor.verifyTotp({ code: totpCode.value.trim() });
    if (result.error) {
      toast.error(result.error.message || "验证失败");
      return;
    }
    toast.success("双重认证已启用");
    setup.value = null;
    totpCode.value = "";
    await loadStatus();
  } catch (cause) {
    toast.error(userErrorMessage(cause));
  } finally {
    loading.value = false;
  }
}

async function disableTwoFactor() {
  loading.value = true;
  try {
    const result = await authClient.twoFactor.disable({ password: currentPassword.value });
    if (result.error) {
      toast.error(result.error.message || "关闭失败");
      return;
    }
    toast.success("双重认证已关闭");
    currentPassword.value = "";
    await loadStatus();
  } catch (cause) {
    toast.error(userErrorMessage(cause));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadStatus({ initial: true });
});
</script>
