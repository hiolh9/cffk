<template>
  <main class="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
    <header class="fixed inset-x-0 top-0 z-50 border-b bg-background">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <StorefrontBrand />
        <PublicNav />
      </div>
    </header>
    <div class="mt-14 flex min-h-0 flex-1 flex-col overflow-y-auto sm:mt-16">
      <section class="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-x-8 gap-y-6 px-4 pb-10 pt-5 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_1fr]">
        <div class="min-w-0 lg:col-start-1 lg:row-start-1">
          <div class="overflow-hidden rounded-md border bg-muted">
            <div class="relative aspect-4/3 max-h-[26rem] w-full overflow-hidden rounded-md bg-muted sm:aspect-video">
              <div v-if="!coverLoaded" class="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
              <img
                :src="data.coverImage || defaultProductImage"
                :alt="data.name"
                width="1200"
                height="675"
                loading="eager"
                decoding="async"
                fetchpriority="high"
                class="h-full w-full object-cover transition-opacity duration-500 ease-out"
                :class="coverLoaded ? 'opacity-100' : 'opacity-0'"
                @load="coverLoaded = true"
                @error="coverLoaded = true"
              />
            </div>
          </div>
          <div class="mt-5">
            <Badge variant="secondary" class="rounded px-2 py-0.5 text-xs font-medium shadow-none">{{ data.categoryName || messages.productCheckout.defaultCategory }}</Badge>
            <h1 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{{ data.name }}</h1>
            <p v-if="data.subtitle" class="mt-2 text-sm leading-6 text-muted-foreground">{{ data.subtitle }}</p>
          </div>
        </div>
        <aside class="min-w-0 self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card class="gap-5 rounded-md py-5 shadow-none">
            <CardHeader class="gap-1 px-5">
              <CardDescription>{{ messages.productCheckout.currentPrice }}</CardDescription>
              <CardTitle class="text-3xl font-bold tabular-nums text-brand">RM{{ selectedSku.price }}</CardTitle>
            </CardHeader>
            <form class="grid min-w-0 gap-5" novalidate @submit.prevent="submit">
              <CardContent class="grid min-w-0 gap-5 px-5">
                <div v-if="!user" class="rounded-md border border-brand/25 bg-brand-soft p-3 text-sm leading-6 text-foreground">
                  购买前请先 <a :href="loginHref" class="font-semibold text-brand underline underline-offset-2">登录</a>。登录后即可下单。
                </div>
                <div v-if="data.skus.length > 1" class="grid gap-2 text-sm font-medium">
                  <span>选择规格</span>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1" role="group" aria-label="选择规格">
                    <Button v-for="sku in data.skus" :key="sku.id" type="button" :variant="String(sku.id) === selectedSkuId ? 'default' : 'outline'" class="h-auto min-h-11 justify-start whitespace-normal rounded-md px-3 py-2 text-left text-sm leading-5 shadow-none" :aria-pressed="String(sku.id) === selectedSkuId" @click="selectedSkuId = String(sku.id)">
                      {{ sku.name }} · RM{{ sku.price }}
                    </Button>
                  </div>
                </div>
                <p v-if="requiresPayment && !methods.length" class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{{ messages.productCheckout.noPaymentMethod }}</p>
                <label class="grid min-w-0 gap-2 text-sm font-medium">
                  <span class="flex items-center gap-1"><span class="text-destructive">*</span> {{ messages.productCheckout.contactEmail }}</span>
                  <Input v-model="contactValue" type="email" inputmode="email" autocomplete="email" required class="h-11 shadow-none" />
                </label>
                <label class="grid min-w-0 gap-2 text-sm font-medium">
                  <span class="flex items-center gap-1"><span class="text-destructive">*</span> {{ messages.productCheckout.quantity }}</span>
                  <Input v-model.number="quantity" type="number" inputmode="numeric" :min="selectedSku.minBuy" :max="purchaseLimit" required class="h-11 shadow-none" />
                  <span v-if="isStockLimited" class="text-xs font-normal text-muted-foreground">{{ t(messages.productCheckout.availableStock, { count: availableStock }) }}</span>
                </label>
                <div v-if="methods.length" class="grid gap-2 text-sm font-medium">
                  <span>{{ messages.productCheckout.paymentMethod }}</span>
                  <div class="grid grid-cols-2 gap-2" role="group" :aria-label="messages.productCheckout.paymentMethod">
                    <Button v-for="item in methods" :key="item.key" type="button" :variant="selectedMethod === item.key ? 'default' : 'outline'" class="h-auto min-h-11 justify-start whitespace-normal rounded-md px-3 py-2 text-left text-sm leading-5 shadow-none" :aria-pressed="selectedMethod === item.key" @click="selectedMethod = item.key">
                      {{ item.name }}{{ item.channel ? `（${channelLabel(item.channel)}）` : '' }}
                    </Button>
                  </div>
                </div>
                <BuyerFormFields v-if="buyerFormFields.length" :fields="buyerFormFields" v-model="formValues" />
                <label class="grid gap-2 text-sm font-medium">{{ messages.productCheckout.buyerNote }}<Textarea v-model="buyerNote" rows="3" class="shadow-none" /></label>
                <p v-if="eligibilityMessage" class="text-sm text-destructive">{{ eligibilityMessage }}</p>
              </CardContent>
              <CardFooter class="flex-col items-stretch gap-3 px-5">
                <Button type="submit" class="h-12 w-full bg-primary text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90" :disabled="!user || loading || isOutOfStock || (requiresPayment && !methods.length)">
                  {{ !user ? '请先登录' : loading ? messages.productCheckout.processingOrder : isOutOfStock ? messages.storefront.outOfStock : requiresPayment ? messages.productCheckout.submitAndPay : messages.productCheckout.createFreeOrder }}
                </Button>
                <p class="text-xs leading-5 text-muted-foreground">{{ messages.productCheckout.paymentAmountNotice }}</p>
              </CardFooter>
            </form>
          </Card>
        </aside>
        <div class="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
          <section v-if="data.description" class="rounded-md border bg-card p-5 sm:p-6">
            <h2 class="text-base font-semibold">{{ messages.productCheckout.productDetails }}</h2>
            <div ref="descriptionRef" class="product-rich-content mt-4 break-words text-sm leading-7 text-foreground [&_a]:text-primary [&_a]:underline [&_img]:my-4 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-md [&_img]:border" @click="previewDescriptionImage" v-html="data.description" />
          </section>
          <section class="rounded-md border bg-muted/40 p-5 text-sm leading-6 sm:p-6">
            <h2 class="font-semibold">{{ messages.productCheckout.purchaseInstructions }}</h2>
            <div class="mt-3 grid gap-3 text-muted-foreground">
              <p class="whitespace-pre-wrap">{{ purchaseNote }}</p>
              <p v-if="deliveryHint" class="whitespace-pre-wrap">{{ deliveryHint }}</p>
            </div>
          </section>
        </div>
      </section>
      <StorefrontFooter />
    </div>
  </main>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useData } from "vike-vue/useData";
import { usePageContext } from "vike-vue/usePageContext";
import PublicNav from "@/components/storefront/PublicNav.vue";
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";
import BuyerFormFields from "@/components/storefront/BuyerFormFields.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import defaultProductImage from "@/assets/product_img.jpg?url";
import { parseBuyerFormJson } from "@/lib/buyer-form";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import { useStorefrontPreferences } from "@/lib/storefront-preferences";
import { onCreatePayment } from "@/server/payment/checkout.telefunc";
import type { PaymentChannel, PaymentProviderKind } from "@/server/payment/registry";
import type { Data } from "./+data.server";

const { messages, t } = useStorefrontPreferences();
const data = useData<Data>();
const coverLoaded = ref(false);
const pageContext = usePageContext() as ReturnType<typeof usePageContext> & { user?: { id: string; email?: string | null } | null };
const user = pageContext.user ?? null;
const loginHref = computed(() => {
  const path = (pageContext as { urlPathname?: string }).urlPathname || `/product/${data.slug}`;
  return `/login?redirect=${encodeURIComponent(path)}`;
});

type PaymentMethod = { key: string; provider: PaymentProviderKind; channel?: PaymentChannel; name: string };
const methods = computed<PaymentMethod[]>(() =>
  data.paymentProviders.flatMap((provider): PaymentMethod[] =>
    provider.channels.length
      ? provider.channels.map((channel) => ({ key: `${provider.provider}:${channel}`, provider: provider.provider, channel, name: provider.name }))
      : [{ key: `${provider.provider}:`, provider: provider.provider, name: provider.name }],
  ),
);
const selectedMethod = ref(methods.value[0]?.key ?? "");
const selectedSkuId = ref(String(data.skus[0]?.id ?? ""));
const selectedSku = computed(() => data.skus.find((s) => String(s.id) === selectedSkuId.value) ?? data.skus[0]);
const quantity = ref(selectedSku.value?.minBuy ?? 1);
const contactValue = ref(user?.email ?? "");
const buyerNote = ref("");
const formValues = ref<Record<string, string>>({});
const loading = ref(false);
const eligibilityMessage = ref("");
const descriptionRef = ref<HTMLElement | null>(null);

const requiresPayment = computed(() => Number(selectedSku.value?.price ?? 0) > 0);
const isStockLimited = computed(() => selectedSku.value?.availableStock != null);
const availableStock = computed(() => selectedSku.value?.availableStock ?? 0);
const purchaseLimit = computed(() =>
  isStockLimited.value
    ? Math.max(selectedSku.value.minBuy, Math.min(selectedSku.value.maxBuy, availableStock.value))
    : selectedSku.value.maxBuy,
);
const isOutOfStock = computed(() => isStockLimited.value && availableStock.value < selectedSku.value.minBuy);
const buyerFormFields = computed(() => parseBuyerFormJson((data as { buyerFormJson?: string | null }).buyerFormJson).fields);
const purchaseNote = computed(() => (data as { purchaseNote?: string | null }).purchaseNote || messages.value.productCheckout.defaultPurchaseNote || "");
const deliveryHint = computed(() => selectedSku.value?.manualDeliveryHint || "");

function enableDescriptionImageLazy() {
  const root = descriptionRef.value;
  if (!root) return;
  root.querySelectorAll("img").forEach((img) => {
    if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    if (img.classList.contains("product-desc-img-ready")) return;
    img.classList.add("product-desc-img-ready", "opacity-0", "transition-opacity", "duration-500", "ease-out");
    const reveal = () => {
      img.classList.remove("opacity-0");
      img.classList.add("opacity-100");
    };
    if (img.complete) reveal();
    else {
      img.addEventListener("load", reveal, { once: true });
      img.addEventListener("error", reveal, { once: true });
    }
  });
}

function previewDescriptionImage(event: MouseEvent) {
  const image = event.target instanceof HTMLImageElement ? event.target : null;
  if (!image || !descriptionRef.value?.contains(image)) return;
}

function channelLabel(channel: string) {
  const map: Record<string, string> = {
    web: messages.value.productCheckout.paymentChannels?.web ?? channel,
    wap: messages.value.productCheckout.paymentChannels?.wap ?? channel,
    face_to_face: messages.value.productCheckout.paymentChannels?.faceToFace ?? channel,
    alipay: messages.value.productCheckout.paymentChannels?.alipay ?? channel,
    wxpay: messages.value.productCheckout.paymentChannels?.wxpay ?? channel,
  };
  return map[channel] ?? channel;
}

watch(() => data.description, () => {
  void nextTick(() => enableDescriptionImageLazy());
});

onMounted(() => {
  enableDescriptionImageLazy();
});

async function submit() {
  if (!user) {
    toast.error("请先登录后再下单");
    return;
  }
  if (isOutOfStock.value) {
    toast.error(messages.value.storefront.outOfStock);
    return;
  }
  loading.value = true;
  eligibilityMessage.value = "";
  try {
    const method = methods.value.find((m) => m.key === selectedMethod.value);
    const deviceId = getOrCreateDeviceId();
    await runTelefunc(() =>
      onCreatePayment({
        productId: data.id,
        productSkuId: selectedSku.value.id,
        quantity: quantity.value,
        contact: contactValue.value,
        buyerNote: buyerNote.value,
        formValues: formValues.value,
        provider: method?.provider,
        channel: method?.channel,
        deviceId,
      } as never),
    );
  } catch (cause) {
    eligibilityMessage.value = userErrorMessage(cause);
  } finally {
    loading.value = false;
  }
}
</script>
