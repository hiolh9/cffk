<template>
  <main class="flex h-dvh flex-col overflow-hidden bg-[#f5f7fb] text-foreground dark:bg-background">
    <header class="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-white dark:border-border dark:bg-background">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <StorefrontBrand />
        <PublicNav />
      </div>
    </header>
    <div class="mt-14 flex min-h-0 flex-1 flex-col overflow-y-auto sm:mt-16">
      <section class="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-x-8 gap-y-6 px-4 pb-10 pt-5 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_1fr]">
        <div class="min-w-0 lg:col-start-1 lg:row-start-1">
          <div class="overflow-hidden rounded-xl border border-black/5 bg-white dark:border-border dark:bg-card">
            <div class="relative aspect-4/3 max-h-[26rem] w-full overflow-hidden bg-muted sm:aspect-video">
              <div v-if="!coverLoaded" class="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
              <img :src="data.coverImage || defaultProductImage" :alt="displayName" width="1200" height="675" loading="eager" decoding="async" fetchpriority="high" class="h-full w-full object-cover transition-opacity duration-500 ease-out" :class="coverLoaded ? 'opacity-100' : 'opacity-0'" @load="coverLoaded = true" @error="coverLoaded = true" />
            </div>
          </div>
          <div class="mt-5">
            <Badge variant="secondary" class="rounded px-2 py-0.5 text-xs font-medium shadow-none">{{ data.categoryName || messages.productCheckout.defaultCategory }}</Badge>
            <h1 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{{ displayName }}</h1>
            <p v-if="displaySubtitle" class="mt-2 text-sm leading-6 text-muted-foreground">{{ displaySubtitle }}</p>
          </div>
        </div>
        <aside class="min-w-0 self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card class="gap-5 rounded-xl border border-black/5 bg-white py-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-border dark:bg-card">
            <CardHeader class="gap-1 px-5">
              <CardDescription>{{ messages.productCheckout.currentPrice }}</CardDescription>
              <CardTitle class="text-3xl font-bold tabular-nums text-brand">RM{{ selectedSku.price }}</CardTitle>
            </CardHeader>
            <form class="grid min-w-0 gap-5" novalidate @submit.prevent="submit">
              <CardContent class="grid min-w-0 gap-5 px-5">
                <div v-if="!user" class="rounded-lg border border-brand/20 bg-brand-soft p-3 text-sm leading-6">
                  <a :href="loginHref" class="font-semibold text-brand underline underline-offset-2">{{ messages.productCheckout.signInLink || 'Sign in' }}</a>
                  — {{ messages.productCheckout.loginToCheckoutHint || 'Sign in to place an order.' }}
                </div>
                <div v-if="data.skus.length > 1" class="grid gap-2 text-sm font-medium">
                  <span>{{ messages.productCheckout.selectSku || 'Select option' }}</span>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1" role="group">
                    <Button v-for="sku in data.skus" :key="sku.id" type="button" :variant="String(sku.id) === selectedSkuId ? 'default' : 'outline'" class="h-auto min-h-11 justify-start whitespace-normal rounded-lg px-3 py-2 text-left text-sm leading-5 shadow-none" :aria-pressed="String(sku.id) === selectedSkuId" @click="selectedSkuId = String(sku.id)">{{ sku.name }} · RM{{ sku.price }}</Button>
                  </div>
                </div>
                <p v-if="requiresPayment && !methods.length" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{{ messages.productCheckout.noPaymentMethod }}</p>
                <label class="grid min-w-0 gap-2 text-sm font-medium"><span class="flex items-center gap-1"><span class="text-destructive">*</span> {{ messages.productCheckout.contactEmail }}</span><Input v-model="contactValue" type="email" inputmode="email" autocomplete="email" required class="h-11 shadow-none" /></label>
                <label class="grid min-w-0 gap-2 text-sm font-medium"><span class="flex items-center gap-1"><span class="text-destructive">*</span> {{ messages.productCheckout.quantity }}</span><Input v-model.number="quantity" type="number" inputmode="numeric" :min="selectedSku.minBuy" :max="purchaseLimit" required class="h-11 shadow-none" /><span v-if="isStockLimited" class="text-xs font-normal text-muted-foreground">{{ t(messages.productCheckout.availableStock, { count: availableStock }) }}</span></label>
                <FieldSet v-if="selectedSku.deliveryType === 'EXPRESS'" class="min-w-0 gap-4 rounded-lg border bg-muted/40 p-4">
                  <FieldLegend>{{ messages.productCheckout.shippingAddress }}</FieldLegend>
                  <Field v-if="addresses.length" class="min-w-0">
                    <FieldLabel for="checkout-address">{{ messages.productCheckout.selectSavedAddress }}</FieldLabel>
                    <Select :model-value="selectedAddress" class="block w-full min-w-0" @update:model-value="onAddressSelectionChange">
                      <SelectTrigger id="checkout-address" class="h-11 w-full! min-w-0 max-w-full bg-background shadow-none"><SelectValue :placeholder="messages.productCheckout.selectShippingAddress" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="item in addresses" :key="String(item.id)" :value="String(item.id)">{{ item.recipientName }} · {{ item.phone }} · {{ addressSummary(item) }}</SelectItem>
                        <SelectItem value="new">{{ messages.productCheckout.enterNewAddress }}</SelectItem>
                        <SelectItem v-if="!user" value="clear-local-addresses" class="text-destructive focus:text-destructive">{{ messages.productCheckout.clearBrowserAddresses }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <p v-else-if="addressesLoading" class="text-sm text-muted-foreground">{{ messages.productCheckout.loadingSavedAddresses }}</p>
                  <div v-if="selectedAddress === 'new' || !addresses.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <VeeField v-for="field in addressFieldsWithoutPostalCode" :key="field.name" v-slot="{ componentField, errors }" :name="field.name" :validate-on-input="true">
                      <Field :data-invalid="errors.length > 0">
                        <FieldLabel :for="`checkout-${field.name}`"><span v-if="field.required" class="text-destructive">*</span> {{ field.label }}</FieldLabel>
                        <Input :id="`checkout-${field.name}`" v-bind="componentField" :autocomplete="field.autocomplete" :aria-invalid="errors.length > 0" class="h-11 bg-background shadow-none" />
                        <FieldError v-if="errors.length" :errors="errors" />
                      </Field>
                    </VeeField>
                    <div class="grid gap-4 sm:col-span-2 lg:col-span-1">
                      <VeeField v-slot="{ componentField, errors }" name="postalCode" :validate-on-input="true">
                        <Field :data-invalid="errors.length > 0">
                          <FieldLabel for="checkout-postalCode">{{ messages.productCheckout.address.postalCode }}</FieldLabel>
                          <Input id="checkout-postalCode" v-bind="componentField" autocomplete="postal-code" :aria-invalid="errors.length > 0" class="h-11 bg-background shadow-none" />
                          <FieldError v-if="errors.length" :errors="errors" />
                        </Field>
                      </VeeField>
                      <Button type="button" variant="outline" class="h-11 w-full shadow-none" :disabled="savingAddress" @click="saveCurrentAddress">{{ savingAddress ? messages.productCheckout.savingAddress : messages.productCheckout.saveAddress }}</Button>
                    </div>
                  </div>
                </FieldSet>
                <div v-if="methods.length" class="grid gap-2 text-sm font-medium">
                  <span>{{ messages.productCheckout.paymentMethod }}</span>
                  <div class="grid grid-cols-2 gap-2" role="group" :aria-label="messages.productCheckout.paymentMethod">
                    <Button v-for="item in methods" :key="item.key" type="button" :variant="selectedMethod === item.key ? 'default' : 'outline'" class="h-auto min-h-11 justify-start whitespace-normal rounded-lg px-3 py-2 text-left text-sm leading-5 shadow-none" :aria-pressed="selectedMethod === item.key" @click="selectedMethod = item.key">{{ item.name }}{{ item.channel ? ` (${channelLabel(item.channel)})` : '' }}</Button>
                  </div>
                </div>
                <div class="grid gap-2 text-sm font-medium">
                  <span>{{ messages.productCheckout.discountCode }}</span>
                  <div class="flex gap-2">
                    <Input v-model="discountCode" autocomplete="off" class="h-11 min-w-0 shadow-none" @keydown.enter.prevent="onApplyDiscount" />
                    <Button type="button" variant="outline" class="h-11 shrink-0 shadow-none" :disabled="discountApplying || !discountCode.trim()" @click="onApplyDiscount">{{ discountApplying ? messages.productCheckout.applyingDiscount : messages.productCheckout.applyDiscount }}</Button>
                  </div>
                </div>
                <div v-if="discountPreview" class="grid gap-1.5 rounded-lg border bg-muted/40 p-3 text-sm">
                  <div class="flex justify-between gap-4"><span class="text-muted-foreground">{{ messages.productCheckout.originalAmount }}</span><span class="tabular-nums">RM{{ discountPreview.originalAmount }}</span></div>
                  <div class="flex justify-between gap-4"><span class="text-muted-foreground">{{ t(messages.productCheckout.appliedDiscount, { code: discountPreview.code }) }}</span><span class="tabular-nums text-destructive">-RM{{ discountPreview.discountAmount }}</span></div>
                  <div class="flex justify-between gap-4 border-t pt-2 font-semibold"><span>{{ messages.productCheckout.amountDue }}</span><span class="tabular-nums">RM{{ discountPreview.finalAmount }}</span></div>
                </div>
                <BuyerFormFields v-if="buyerFormFields.length" :fields="buyerFormFields" v-model="formValues" />
                <label class="grid gap-2 text-sm font-medium">{{ messages.productCheckout.buyerNote }}<Textarea v-model="buyerNote" rows="3" class="shadow-none" /></label>
                <p v-if="eligibilityMessage" class="text-sm text-destructive">{{ eligibilityMessage }}</p>
              </CardContent>
              <CardFooter class="flex-col items-stretch gap-3 px-5">
                <Button type="submit" class="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90" :disabled="!user || loading || isOutOfStock || (requiresPayment && !methods.length)">{{ !user ? (messages.productCheckout.loginRequired || 'Sign in first') : loading ? messages.productCheckout.processingOrder : isOutOfStock ? messages.storefront.outOfStock : requiresPayment ? messages.productCheckout.submitAndPay : messages.productCheckout.createFreeOrder }}</Button>
                <p class="text-xs leading-5 text-muted-foreground">{{ messages.productCheckout.paymentAmountNotice }}</p>
              </CardFooter>
            </form>
          </Card>
        </aside>
        <div class="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
          <section v-if="displayDescription" class="rounded-xl border border-black/5 bg-white p-5 shadow-sm dark:border-border dark:bg-card sm:p-6">
            <h2 class="text-base font-semibold">{{ messages.productCheckout.productDetails }}</h2>
            <!-- eslint-disable vue/no-v-html -->
            <div ref="descriptionRef" class="product-rich-content mt-4 break-words text-sm leading-7 text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-[1.1rem] [&_h3]:font-semibold [&_img]:my-4 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-md [&_img]:border [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6" @click="previewDescriptionImage" v-html="displayDescription" />
            <!-- eslint-enable vue/no-v-html -->
          </section>
          <section class="rounded-xl border border-black/5 bg-white p-5 text-sm leading-6 shadow-sm dark:border-border dark:bg-card sm:p-6">
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
    <Dialog :open="Boolean(previewImage)" @update:open="(open) => { if (!open) previewImage = null; }">
      <DialogContent :show-close-button="false" class="w-fit! max-w-[calc(100vw-2rem)]! border-0 bg-transparent p-0 shadow-none sm:max-w-[calc(100vw-4rem)]!" @interact-outside="previewImage = null">
        <DialogTitle class="sr-only">{{ messages.productCheckout.imagePreview }}</DialogTitle>
        <div class="relative inline-flex">
          <img v-if="previewImage" :src="previewImage.src" :alt="previewImage.alt" class="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] rounded-md object-contain sm:max-w-[calc(100vw-4rem)]" />
          <DialogClose as-child><Button type="button" variant="ghost" size="icon" class="absolute right-2 top-2 size-10 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white" :aria-label="messages.productCheckout.closeImagePreview"><XIcon /></Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog :open="clearAddressesDialogOpen" @update:open="(open) => { clearAddressesDialogOpen = open; if (!open) selectedAddress = previousAddressSelection; }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ messages.productCheckout.confirmClearAddressesTitle }}</DialogTitle>
          <DialogDescription>{{ messages.productCheckout.confirmClearAddressesDescription }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" @click="clearAddressesDialogOpen = false">{{ messages.productCheckout.cancel }}</Button>
          <Button type="button" variant="destructive" @click="confirmClearSavedAddresses">{{ messages.productCheckout.confirmClearAddresses }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main>
</template>
<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { toTypedSchema } from "@vee-validate/zod";
import { Field as VeeField, useForm } from "vee-validate";
import { z } from "zod";
import { XIcon } from "@lucide/vue";
import { toast } from "vue-sonner";
import { useData } from "vike-vue/useData";
import { usePageContext } from "vike-vue/usePageContext";
import { stripLocalePrefix } from "@/lib/i18n/locale-path";
import PublicNav from "@/components/storefront/PublicNav.vue";
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import StorefrontFooter from "@/components/storefront/StorefrontFooter.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import defaultProductImage from "@/assets/product_img.jpg?url";
import { clearLocalAddresses, getLocalAddresses, saveLocalAddress, type LocalAddress } from "@/lib/local-addresses";
import { useStorefrontPreferences } from "@/lib/storefront-preferences";
import { saveGuestOrder } from "@/lib/local-orders";
import { cacheQrPayment } from "@/lib/payment-utils";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import BuyerFormFields from "@/components/storefront/BuyerFormFields.vue";
import { parseBuyerFormJson } from "@/lib/buyer-form";
import { onGetCheckoutEligibility } from "@/server/payment/checkout-eligibility.telefunc";
import { onCreateAddress, onListAddresses } from "@/server/address/index.telefunc";
import { onPreviewDiscount } from "@/server/discount/preview.telefunc";
import { onCreatePayment } from "@/server/payment/checkout.telefunc";
import type { PaymentChannel, PaymentProviderKind } from "@/server/payment/registry";
import type { Data } from "./+data.server";
const { messages, t } = useStorefrontPreferences();
const data = useData<Data>();
const coverLoaded = ref(false);
watch(() => data.description, () => { void nextTick(() => enableDescriptionImageLazy()); });
const pageContext = usePageContext() as ReturnType<typeof usePageContext> & { user?: { id: string;
const preferEn = computed(() => stripLocalePrefix(pageContext.urlPathname || "/").locale === "en");
const displayName = computed(() => {
  const en = (data as { nameEn?: string | null }).nameEn;
  return preferEn.value && en ? en : data.name;
});
const displaySubtitle = computed(() => {
  const en = (data as { subtitleEn?: string | null }).subtitleEn;
  if (preferEn.value && en) return en;
  return data.subtitle;
});
const displayDescription = computed(() => {
  const en = (data as { descriptionEn?: string | null }).descriptionEn;
  if (preferEn.value && en) return en;
  return data.description;
}); email?: string | null } | null };
const user = pageContext.user ?? null;
const loginHref = computed(() => `/login?redirect=${encodeURIComponent(pageContext.urlOriginal || `/product/${data.slug}`)}`);
const selectedSkuId = ref(String(data.skus[0]?.id ?? ""));
const selectedSku = computed(() => data.skus.find((s) => String(s.id) === selectedSkuId.value) ?? data.skus[0]);
const quantity = ref(selectedSku.value?.minBuy ?? 1);
const contactValue = ref(user?.email ?? "");
const buyerNote = ref("");
const formValues = ref<Record<string, string>>({});
const buyerFormFields = computed(() => parseBuyerFormJson((selectedSku.value as { buyerFormJson?: string } | undefined)?.buyerFormJson ?? (data as { buyerFormJson?: string }).buyerFormJson ?? ""));
const loading = ref(false);
const methods = ref<{ key: string; name: string; channel?: string }[]>([]);
const selectedMethod = ref("");
const requiresPayment = computed(() => Number(selectedSku.value?.price ?? 0) > 0);
const availableStock = computed(() => selectedSku.value?.availableStock ?? null);
const isStockLimited = computed(() => availableStock.value !== null);
const isOutOfStock = computed(() => availableStock.value === 0);
const purchaseLimit = computed(() => (availableStock.value === null ? 999 : Math.max(1, availableStock.value)));
const discountCode = ref("");
const discountApplying = ref(false);
const discountPreview = ref<{ code: string; originalAmount: number; discountAmount: number; finalAmount: number } | null>(null);
const eligibilityMessage = ref("");
type SavedAddress = LocalAddress & { id: string | number; isDefault?: boolean };
const addresses = ref<SavedAddress[]>([]);
const addressesLoading = ref(false);
const selectedAddress = ref("new");
const previousAddressSelection = ref("new");
const clearAddressesDialogOpen = ref(false);
const savingAddress = ref(false);
const previewImage = ref<{ src: string; alt: string } | null>(null);
const descriptionRef = ref<HTMLElement | null>(null);
const addressSchema = z.object({
  recipientName: z.string().min(1),
  phone: z.string().min(5),
  country: z.string().min(1),
  province: z.string().min(1),
  city: z.string().min(1),
  district: z.string().min(1),
  addressLine: z.string().min(1),
  postalCode: z.string().optional(),
});
type AddressForm = z.infer<typeof addressSchema>;
const { handleSubmit, defineField } = useForm({ validationSchema: toTypedSchema(addressSchema), initialValues: { recipientName: "", phone: "", country: "", province: "", city: "", district: "", addressLine: "", postalCode: "" } });
const addressFieldsWithoutPostalCode = [
  { name: "recipientName" as const, label: messages.value.productCheckout.address.recipientName, required: true, autocomplete: "name" },
  { name: "phone" as const, label: messages.value.productCheckout.address.phone, required: true, autocomplete: "tel" },
  { name: "country" as const, label: messages.value.productCheckout.address.country, required: true, autocomplete: "country-name" },
  { name: "province" as const, label: messages.value.productCheckout.address.province, required: true, autocomplete: "address-level1" },
  { name: "city" as const, label: messages.value.productCheckout.address.city, required: true, autocomplete: "address-level2" },
  { name: "district" as const, label: messages.value.productCheckout.address.district, required: true, autocomplete: "address-level3" },
  { name: "addressLine" as const, label: messages.value.productCheckout.address.addressLine, required: true, autocomplete: "street-address" },
];
const purchaseNote = computed(() => data.purchaseNote || messages.value.productCheckout.defaultPurchaseNote);
const deliveryHint = computed(() => {
  if (selectedSku.value?.deliveryType === "EXPRESS") return data.manualDeliveryHint || messages.value.productCheckout.defaultExpressDeliveryHint;
  return data.manualDeliveryHint || messages.value.productCheckout.defaultManualDeliveryHint;
});
function enableDescriptionImageLazy() {
  const root = descriptionRef.value;
  if (!root) return;
  root.querySelectorAll("img").forEach((img) => {
    if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
    img.style.opacity = "0";
    img.style.transition = "opacity 0.4s ease";
    if (img.complete) img.style.opacity = "1";
    else img.addEventListener("load", () => { img.style.opacity = "1"; }, { once: true });
  });
}
function previewDescriptionImage(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (t.tagName === "IMG") previewImage.value = { src: (t as HTMLImageElement).src, alt: (t as HTMLImageElement).alt || data.name };
}
async function onApplyDiscount() {
  const code = discountCode.value.trim();
  if (!code) return;
  discountApplying.value = true;
  try {
    const result = await runTelefunc(() => onPreviewDiscount({ code, skuId: Number(selectedSku.value.id), quantity: quantity.value }), { notifyError: false });
    discountPreview.value = result as typeof discountPreview.value;
  } catch (cause) {
    discountPreview.value = null;
    toast.error(userErrorMessage(cause, messages.value.productCheckout.discountPreviewFailed));
  } finally {
    discountApplying.value = false;
  }
}
async function submit() {
  if (!user) {
    toast.error(messages.value.productCheckout.loginToCheckout || "Sign in before placing an order.");
    window.location.assign(loginHref.value);
    return;
  }
  if (isOutOfStock.value) {
    toast.error(messages.value.productCheckout.insufficientStock);
    return;
  }
  loading.value = true;
  eligibilityMessage.value = "";
  try {
    const deviceId = getOrCreateDeviceId();
    const payload = {
      skuId: Number(selectedSku.value.id),
      quantity: quantity.value,
      contactEmail: contactValue.value,
      buyerNote: buyerNote.value,
      formValues: formValues.value,
      discountCode: discountCode.value.trim() || undefined,
      paymentMethodKey: selectedMethod.value || undefined,
      deviceId,
    };
    const elig = await runTelefunc(() => onGetCheckoutEligibility({ skuId: payload.skuId, quantity: payload.quantity, deviceId }), { notifyError: false }).catch(() => null);
    if (elig && ((elig as { ok?: boolean }).ok === false || (elig as { blockers?: unknown[] }).blockers?.length)) {
      const msg = (elig as { blockers?: { message?: string }[] }).blockers?.[0]?.message || (elig as { message?: string }).message || messages.value.productCheckout.cannotCheckout || "Checkout unavailable";
      eligibilityMessage.value = String(msg);
      loading.value = false;
      return;
    }
    const result = await runTelefunc(() => onCreatePayment(payload as never));
    if (result && typeof result === "object" && "orderNo" in result) {
      if (user) { /* account order */ }
      else saveGuestOrder({ orderNo: String((result as { orderNo: string }).orderNo), email: contactValue.value });
      if ((result as { payUrl?: string }).payUrl) window.location.assign(String((result as { payUrl: string }).payUrl));
      else if ((result as { qrContent?: string }).qrContent) {
        cacheQrPayment(result as never);
        window.location.assign(`/checkout/qr?order=${encodeURIComponent(String((result as { orderNo: string }).orderNo))}`);
      } else window.location.assign(`/account/order`);
    }
  } catch (cause) {
    toast.error(userErrorMessage(cause, messages.value.productCheckout.orderSubmissionFailed));
  } finally {
    loading.value = false;
  }
}
async function saveCurrentAddress() {
  savingAddress.value = true;
  try {
    /* simplified: rely on form fields via handleSubmit path if expanded later */
    toast.message("Use the address form fields then save.");
  } finally {
    savingAddress.value = false;
  }
}
function onAddressSelectionChange(value: unknown) {
  if (value === "clear-local-addresses") {
    previousAddressSelection.value = selectedAddress.value;
    clearAddressesDialogOpen.value = true;
    return;
  }
  if (typeof value === "string") selectedAddress.value = value;
}
function confirmClearSavedAddresses() {
  if (!clearLocalAddresses()) {
    toast.error(messages.value.productCheckout.clearAddressesFailed);
    return;
  }
  addresses.value = [];
  selectedAddress.value = "new";
  clearAddressesDialogOpen.value = false;
  toast.success(messages.value.productCheckout.addressesCleared);
}
async function loadAddresses() {
  if (selectedSku.value?.deliveryType !== "EXPRESS") return;
  addressesLoading.value = true;
  try {
    addresses.value = user ? await runTelefunc(() => onListAddresses(), { notifyError: false }) as SavedAddress[] : getLocalAddresses() as SavedAddress[];
    const preferred = addresses.value.find((item) => item.isDefault) ?? addresses.value[0];
    selectedAddress.value = preferred ? String(preferred.id) : "new";
  } catch (cause) {
    toast.error(userErrorMessage(cause, messages.value.productCheckout.addressLoadFailed));
    selectedAddress.value = "new";
  } finally {
    addressesLoading.value = false;
  }
}
function addressSummary(address: SavedAddress) {
  return `${address.province}${address.city}${address.district}${address.addressLine}`;
}
onMounted(() => {
  enableDescriptionImageLazy();
  void loadAddresses();
  // load payment methods from data if present
  const m = (data as { paymentMethods?: typeof methods.value }).paymentMethods;
  if (m?.length) {
    methods.value = m;
    selectedMethod.value = m[0]?.key ?? "";
  }
});
function channelLabel(channel: string) {
  return ({ web: messages.value.productCheckout.paymentChannels.web, wap: messages.value.productCheckout.paymentChannels.wap, face_to_face: messages.value.productCheckout.paymentChannels.faceToFace, alipay: messages.value.productCheckout.paymentChannels.alipay, wxpay: messages.value.productCheckout.paymentChannels.wxpay } as Record<string, string>)[channel] ?? channel;
}
</script>
