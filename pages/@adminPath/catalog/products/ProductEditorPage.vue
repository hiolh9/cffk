<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader>
      <template #actions>
        <div class="flex items-center gap-2">
          <Button variant="outline" :disabled="saving" @click="goBack">返回商品列表</Button>
          <Button type="submit" form="product-editor-form" :disabled="saving || loading">
            {{ saving ? "保存中..." : loading ? "加载中..." : editing ? "保存商品" : "创建商品" }}
          </Button>
        </div>
      </template>
    </AdminPageHeader>

    <form id="product-editor-form" class="border-t" novalidate @submit.prevent="submit">
      <div class="grid gap-8 px-6 py-6 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,1fr)]">
        <FieldGroup class="gap-6">
          <FieldSet class="gap-4">
            <FieldLegend><span class="text-destructive">*</span> 商品名称</FieldLegend>
            <VeeField v-slot="{ componentField, errors }" name="name">
              <Field :data-invalid="errors.length > 0">
                <Input id="product-name" v-bind="componentField" placeholder="例如：Pro 会员月卡" aria-label="商品名称" :aria-invalid="errors.length > 0" />
                <FieldError v-if="errors.length" :errors="errors" />
              </Field>
            </VeeField>
          </FieldSet>
          <FieldSeparator />
          <FieldSet class="gap-4">
            <FieldLegend><span class="text-destructive">*</span> 商品详情</FieldLegend>
            <VeeField v-slot="{ errors }" name="description">
              <Field :data-invalid="errors.length > 0">
                <ProductRichTextEditor :model-value="values.description" @update:model-value="setFieldValue('description', $event)" />
                <FieldError v-if="errors.length" :errors="errors" />
              </Field>
            </VeeField>
          </FieldSet>
          <FieldSeparator />
          <FieldSet class="gap-4">
            <FieldLegend>English content（/en 路由）</FieldLegend>
            <FieldDescription>可选。填写后在英文路径 /en/product/... 优先展示；留空则回退到上方默认内容。</FieldDescription>
            <VeeField v-slot="{ componentField }" name="nameEn">
              <Field>
                <FieldLabel for="product-name-en">英文名称</FieldLabel>
                <Input id="product-name-en" v-bind="componentField" placeholder="e.g. Pro Membership Monthly" />
              </Field>
            </VeeField>
            <VeeField v-slot="{ componentField }" name="subtitleEn">
              <Field>
                <FieldLabel for="product-subtitle-en">英文副标题</FieldLabel>
                <Input id="product-subtitle-en" v-bind="componentField" placeholder="Short English summary" />
              </Field>
            </VeeField>
            <VeeField v-slot="{ errors }" name="descriptionEn">
              <Field :data-invalid="errors.length > 0">
                <FieldLabel>英文正文</FieldLabel>
                <ProductRichTextEditor :model-value="values.descriptionEn || ''" @update:model-value="setFieldValue('descriptionEn', $event)" />
                <FieldError v-if="errors.length" :errors="errors" />
              </Field>
            </VeeField>
          </FieldSet>
          <FieldSeparator />
          <FieldSet class="gap-4">
            <FieldLegend>购买须知</FieldLegend>
            <VeeField v-slot="{ componentField }" name="purchaseNote">
              <Field>
                <Textarea v-bind="componentField" rows="3" placeholder="例如：虚拟商品售出后不支持退款" aria-label="购买须知" />
              </Field>
            </VeeField>
          </FieldSet>
          <VeeField v-slot="{ value, handleChange }" name="buyerFormJson">
            <BuyerFormEditor :model-value="value || ''" @update:model-value="handleChange" />
          </VeeField>
          <FieldSeparator />
                  <FieldSet class="gap-3">
            <FieldLegend>涉及税种</FieldLegend>
            <FieldDescription>勾选后，订单支付成功会生成未报税务义务；不选则不产生。</FieldDescription>
            <div v-if="taxTypeOptions.length" class="flex flex-col gap-2">
              <label
                v-for="t in taxTypeOptions"
                :key="t.id"
                class="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  class="size-4"
                  :checked="selectedTaxTypeIds.includes(t.id)"
                  @change="toggleTaxType(t.id, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ t.code }} · {{ t.name }}（默认 {{ t.defaultRatePercent }}%）</span>
              </label>
            </div>
            <p v-else class="text-sm text-muted-foreground">暂无启用税种，请先到「税务中心」创建。</p>
          </FieldSet>
          <FieldSet v-if="isSupplierProduct" class="gap-2">
            <FieldLegend>履约方式</FieldLegend>
            <FieldDescription>供应商履约。供应商绑定由供应商管理模块维护。</FieldDescription>
          </FieldSet>
          <FieldSet v-else class="gap-4">
            <FieldLegend><span class="text-destructive">*</span> 发货方式</FieldLegend>
            <FieldDescription>
              {{ editing ? "商品创建后不能修改发货方式。" : "一个商品统一使用一种发货方式。" }}
            </FieldDescription>
            <RadioGroup
              :model-value="deliveryType"
              class="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
              :disabled="editing || saving || skuSaving || deliveryChanging"
              @update:model-value="changeDeliveryType"
            >
              <label
                v-for="option in deliveryOptions"
                :key="option.value"
                class="flex cursor-pointer gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
              >
                <RadioGroupItem :value="option.value" class="mt-1" />
                <span class="grid gap-1">
                  <span class="text-sm font-medium">{{ option.label }}</span>
                  <span class="text-xs text-muted-foreground">{{ option.description }}</span>
                </span>
              </label>
            </RadioGroup>
          </FieldSet>
          <FieldSeparator />
          <FieldSet class="gap-4">
            <div class="flex items-center justify-between gap-3">
              <FieldLegend>SKU 与价格</FieldLegend>
              <Button v-if="!isSupplierProduct" type="button" variant="outline" size="sm" :disabled="saving || skuSaving" @click="addSku">添加 SKU</Button>
            </div>
            <div class="overflow-x-auto rounded-lg border">
              <table v-if="skuDrafts.length" class="w-full text-sm">
                <thead class="border-b bg-muted/40 text-left">
                  <tr>
                    <th class="p-3">SKU 名称</th>
                    <th class="p-3 min-w-56">价格（MYR 主价 + 区域价）</th>
                    <th class="p-3">购买范围</th>
                    <th class="p-3">库存/内容</th>
                    <th class="p-3">状态</th>
                    <th class="p-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="sku in skuDrafts" :key="sku.id ?? sku.clientKey" class="border-b last:border-0">
                    <td class="p-3"><Input v-model="sku.name" /></td>
                    <td class="p-3">
                      <div class="flex min-w-52 flex-col gap-1.5">
                        <div class="flex items-center gap-2">
                          <span class="w-10 shrink-0 text-xs text-muted-foreground">MYR</span>
                          <Input v-model="sku.price" inputmode="decimal" placeholder="主价" />
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-10 shrink-0 text-xs text-muted-foreground">USD</span>
                          <Input v-model="sku.regionalPrices.USD" inputmode="decimal" placeholder="可选" />
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-10 shrink-0 text-xs text-muted-foreground">SGD</span>
                          <Input v-model="sku.regionalPrices.SGD" inputmode="decimal" placeholder="可选" />
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-10 shrink-0 text-xs text-muted-foreground">AUD</span>
                          <Input v-model="sku.regionalPrices.AUD" inputmode="decimal" placeholder="可选" />
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-10 shrink-0 text-xs text-muted-foreground">JPY</span>
                          <Input v-model="sku.regionalPrices.JPY" inputmode="numeric" placeholder="整日元" />
                        </div>
                      </div>
                    </td>
                    <td class="p-3">
                      <div v-if="!isSupplierProduct" class="flex min-w-36 items-center gap-2">
                        <Input v-model.number="sku.minBuy" type="number" min="1" :disabled="deliveryType === 'FIXED_CARD'" />
                        <span>-</span>
                        <Input v-model.number="sku.maxBuy" type="number" min="1" :disabled="deliveryType === 'FIXED_CARD'" />
                      </div>
                      <span v-else class="text-muted-foreground">供应商配置</span>
                    </td>
                    <td class="min-w-52 p-3">
                      <span v-if="isSupplierProduct" class="text-muted-foreground">供应商履约</span>
                      <Input
                        v-else-if="deliveryType === 'MANUAL' || deliveryType === 'EXPRESS'"
                        :model-value="sku.physicalStock ?? 0"
                        type="number"
                        min="0"
                        @update:model-value="sku.physicalStock = Number($event)"
                      />
                      <Textarea v-else-if="deliveryType === 'FIXED_CARD'" v-model="sku.fixedDeliveryContent" rows="1" />
                      <span v-else class="text-muted-foreground">卡密库存</span>
                    </td>
                    <td class="p-3">
                      <Select v-model="sku.status">
                        <SelectTrigger class="min-w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">启用</SelectItem>
                          <SelectItem value="INACTIVE">停用</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td class="whitespace-nowrap p-3">
                      <div class="flex gap-2">
                        <Button v-if="editing && !isSupplierProduct" type="button" size="sm" :disabled="skuSaving" @click="saveSku(sku)">{{ sku.id ? '保存' : '创建' }}</Button>
                        <Button v-if="editing && sku.id && !isSupplierProduct" type="button" size="sm" variant="destructive" :disabled="skuSaving" @click="removeSku(sku)">删除</Button>
                        <Button v-if="!sku.id && !isSupplierProduct" type="button" size="sm" variant="ghost" :disabled="skuSaving" @click="discardSku(sku)">移除</Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="p-4 text-sm text-muted-foreground">暂无 SKU，请点击「添加 SKU」。</p>
            </div>
          </FieldSet>
        </FieldGroup>

        <aside class="lg:border-l lg:pl-8">
          <FieldGroup class="gap-6">
            <FieldSet class="gap-4">
              <FieldLegend>商品分类</FieldLegend>
              <VeeField v-slot="{ errors }" name="categoryId">
                <Field :data-invalid="errors.length > 0">
                  <FieldLabel for="product-category"><span class="text-destructive">*</span> 分类</FieldLabel>
                  <Select :model-value="String(values.categoryId || '')" @update:model-value="setFieldValue('categoryId', Number($event))">
                    <SelectTrigger id="product-category" :aria-invalid="errors.length > 0"><SelectValue placeholder="选择分类" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="item in activeCategories" :key="item.id" :value="String(item.id)">{{ item.name }}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError v-if="errors.length" :errors="errors" />
                </Field>
              </VeeField>
              <VeeField v-slot="{ componentField }" name="sort">
                <Field>
                  <FieldLabel>商品排序</FieldLabel>
                  <Input v-bind="componentField" type="number" min="0" />
                </Field>
              </VeeField>
            </FieldSet>
            <FieldSeparator />
            <FieldSet class="gap-4">
              <FieldLegend>SEO</FieldLegend>
              <VeeField v-slot="{ componentField, errors }" name="slug">
                <Field :data-invalid="errors.length > 0">
                  <FieldLabel for="product-slug">Slug</FieldLabel>
                  <Input id="product-slug" v-bind="componentField" placeholder="留空则自动生成" :aria-invalid="errors.length > 0" @update:model-value="onSlug" />
                  <FieldDescription>前台路径：/product/{{ values.slug || "slug" }}</FieldDescription>
                  <FieldError v-if="errors.length" :errors="errors" />
                </Field>
              </VeeField>
              <VeeField v-slot="{ componentField }" name="subtitle">
                <Field>
                  <FieldLabel for="product-subtitle">副标题</FieldLabel>
                  <Input id="product-subtitle" v-bind="componentField" placeholder="用于 SEO 摘要" />
                </Field>
              </VeeField>
            </FieldSet>
            <ProductSeoFields />
            <FieldSeparator />
            <FieldSet class="gap-4">
              <FieldLegend>商品封面</FieldLegend>
              <VeeField v-slot="{ componentField }" name="coverImage">
                <Field>
                  <FieldLabel for="product-cover">封面 URL</FieldLabel>
                  <div class="grid gap-2">
                    <Input id="product-cover" v-bind="componentField" placeholder="/media/proxy/... 或外部图片 URL" />
                    <Button type="button" variant="outline" @click="mediaPickerOpen = true">从媒体库选择</Button>
                  </div>
                  <img v-if="values.coverImage" :src="values.coverImage" alt="商品封面预览" class="aspect-video w-full rounded-md border object-cover" />
                </Field>
              </VeeField>
            </FieldSet>
            <FieldSeparator />
            <FieldSet class="gap-4">
              <FieldLegend>发布设置</FieldLegend>
              <VeeField name="status">
                <Field>
                  <FieldLabel>状态</FieldLabel>
                  <Select v-model="status">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">草稿</SelectItem>
                      <SelectItem value="ACTIVE">上架</SelectItem>
                      <SelectItem value="INACTIVE">下架</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </VeeField>
              <VeeField name="taxCategory">
                <Field>
                  <FieldLabel>税务分类（SST）</FieldLabel>
                  <Select v-model="taxCategory">
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="选择税务分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Digital_Goods">Digital_Goods（数字商品）</SelectItem>
                      <SelectItem value="Digital_Service">Digital_Service（数字服务）</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>钻石等选 Goods；软件会员选 Service。仅影响马来西亚 SST 口径。</FieldDescription>
                </Field>
              </VeeField>
            </FieldSet>
          </FieldGroup>
        </aside>
      </div>

      <div class="flex items-center justify-end gap-2 border-t px-6 py-4">
        <Button type="button" variant="outline" :disabled="saving || loading" @click="goBack">取消</Button>
        <Button type="submit" :disabled="saving || loading">
          {{ saving ? "保存中..." : loading ? "加载中..." : editing ? "保存商品" : "创建商品" }}
        </Button>
      </div>
    </form>

    <MediaPickerDialog v-model:open="mediaPickerOpen" @select="setFieldValue('coverImage', $event)" />

    <Dialog v-model:open="deliveryChangeDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>切换发货方式？</DialogTitle>
          <DialogDescription>当前 SKU 配置会被清空并重置。此操作不可恢复。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" :disabled="deliveryChanging" @click="deliveryChangeDialogOpen = false">取消</Button>
          <Button type="button" variant="destructive" :disabled="deliveryChanging" @click="confirmDeliveryTypeChange">
            {{ deliveryChanging ? "处理中..." : "清空并切换" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import { navigate } from "vike/client/router";
import { toast } from "vue-sonner";
import { toTypedSchema } from "@vee-validate/zod";
import { Field as VeeField, useForm } from "vee-validate";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import MediaPickerDialog from "@/components/admin/MediaPickerDialog.vue";
import BuyerFormEditor from "@/components/admin/BuyerFormEditor.vue";
import ProductSeoFields from "@/components/admin/ProductSeoFields.vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCentsAsYuan } from "@/lib/payment-utils";
import { runTelefunc } from "@/lib/telefunc-client";
import {
  onDeleteProductSku,
  onGetCatalogAdminData,
  onGetProductAdminDetail,
  onSaveProduct,
  onSaveProductSku,
  onSaveSupplierProductPresentation,
} from "@/server/catalog/admin.telefunc";
import {
  defaultProductForm,
  formToSaveInput,
  productDetailToForm,
  productFormSchema,
  slugifyProductName,
  type ProductDeliveryType,
  type ProductForm,
} from "./product-form";
import { onGetProductTaxLinks } from "@/server/accounting/tax.admin.telefunc";
const ProductRichTextEditor = defineAsyncComponent(() => import("./ProductRichTextEditor.vue"));

const props = defineProps<{ productId?: number }>();
const pageContext = usePageContext();
const adminPath = (pageContext.routeParams as { adminPath?: string }).adminPath || "admin";

const editing = computed(() => Boolean(props.productId));
const loading = ref(false);
const saving = ref(false);
const skuSaving = ref(false);
const mediaPickerOpen = ref(false);
const deliveryChanging = ref(false);
const deliveryChangeDialogOpen = ref(false);
const pendingDeliveryType = ref<ProductDeliveryType | null>(null);

type RegionalPriceForm = {
  USD: string;
  SGD: string;
  AUD: string;
  JPY: string;
};

function emptyRegionalPrices(): RegionalPriceForm {
  return { USD: "", SGD: "", AUD: "", JPY: "" };
}

function normalizeRegionalForm(raw: unknown): RegionalPriceForm {
  const base = emptyRegionalPrices();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const code of ["USD", "SGD", "AUD", "JPY"] as const) {
    const v = o[code];
    if (v != null && String(v).trim()) base[code] = String(v).trim();
  }
  return base;
}

type ProductSkuSaveInput = {
  id?: number;
  productId: number;
  name: string;
  price: string;
  status: "ACTIVE" | "INACTIVE";
  deliveryType: ProductDeliveryType;
  fixedDeliveryContent?: string;
  physicalStock: number | null;
  minBuy: number;
  maxBuy: number;
  sort: number;
  regionalPrices?: RegionalPriceForm;
};

type SkuDraft = Omit<ProductSkuSaveInput, "deliveryType"> & {
  fulfillmentSource?: "LOCAL" | "SUPPLIER";
  deliveryType: ProductDeliveryType | "SUPPLIER";
  clientKey: string;
  fixedDeliveryContent: string;
  regionalPrices: RegionalPriceForm;
};

const skuDrafts = ref<SkuDraft[]>([]);
const deliveryType = ref<ProductDeliveryType>("CARD_AUTO");
const categories = ref<Array<{ id: number; name: string; status: string }>>([]);
const taxTypeOptions = ref<Array<{ id: number; code: string; name: string; defaultRatePercent: number }>>([]);
const selectedTaxTypeIds = ref<number[]>([]);

const activeCategories = computed(() => categories.value.filter((c) => c.status === "ACTIVE"));
const isSupplierProduct = computed(
  () => skuDrafts.value.length > 0 && skuDrafts.value.every((sku) => sku.fulfillmentSource === "SUPPLIER"),
);

const deliveryOptions = [
  { value: "CARD_AUTO" as const, label: "卡密自动", description: "自动发码" },
  { value: "FIXED_CARD" as const, label: "固定内容", description: "固定文案发货" },
  { value: "MANUAL" as const, label: "人工发货", description: "后台手动处理" },
  { value: "EXPRESS" as const, label: "快递/实物", description: "需库存数量" },
];

const { handleSubmit, resetForm, setFieldValue, values, defineField } = useForm({
  validationSchema: toTypedSchema(productFormSchema),
  initialValues: defaultProductForm(),
});
const [status] = defineField("status");
const [taxCategory] = defineField("taxCategory");

function goBack() {
  navigate(`/${adminPath}/catalog/products`);
}

function onSlug(v: string | number) {
  const s = String(v ?? "");
  setFieldValue("slug", s.trim() ? slugifyProductName(s) : "");
}

function toggleTaxType(id: number, checked: boolean) {
  if (checked) selectedTaxTypeIds.value = [...new Set([...selectedTaxTypeIds.value, id])];
  else selectedTaxTypeIds.value = selectedTaxTypeIds.value.filter((x) => x !== id);
}

function addSku() {
  skuDrafts.value.push({
    clientKey: crypto.randomUUID(),
    productId: props.productId ?? 0,
    name: `新规格${skuDrafts.value.length + 1}`,
    price: "0.01",
    status: "ACTIVE",
    deliveryType: deliveryType.value,
    fixedDeliveryContent: "",
    physicalStock: null,
    minBuy: 1,
    maxBuy: 1,
    sort: skuDrafts.value.length,
    regionalPrices: emptyRegionalPrices(),
  });
}

function discardSku(sku: SkuDraft) {
  skuDrafts.value = skuDrafts.value.filter((item) => item !== sku);
}

async function saveSku(sku: SkuDraft) {
  if (!props.productId) return;
  skuSaving.value = true;
  try {
    const input: ProductSkuSaveInput = {
      id: sku.id,
      productId: props.productId,
      name: sku.name,
      price: sku.price,
      status: sku.status,
      deliveryType: deliveryType.value,
      fixedDeliveryContent: sku.fixedDeliveryContent,
      physicalStock: sku.physicalStock,
      minBuy: sku.minBuy,
      maxBuy: sku.maxBuy,
      sort: sku.sort,
      regionalPrices: sku.regionalPrices,
    };
    const saved = await runTelefunc(() => onSaveProductSku(input), {
      successMessage: sku.id ? "SKU 已保存。" : "SKU 已创建。",
    });
    Object.assign(sku, {
      ...saved,
      clientKey: sku.clientKey,
      price: formatCentsAsYuan(saved.price),
      fixedDeliveryContent: saved.fixedDeliveryContent ?? "",
      regionalPrices: normalizeRegionalForm((saved as { regionalPrices?: unknown }).regionalPrices ?? sku.regionalPrices),
    });
  } catch {
    /* toast via runTelefunc */
  } finally {
    skuSaving.value = false;
  }
}

async function removeSku(sku: SkuDraft) {
  if (!sku.id) return;
  skuSaving.value = true;
  try {
    await runTelefunc(() => onDeleteProductSku({ id: sku.id! }), { successMessage: "SKU 已删除。" });
    skuDrafts.value = skuDrafts.value.filter((item) => item !== sku);
  } catch {
    /* */
  } finally {
    skuSaving.value = false;
  }
}

function changeDeliveryType(next: string) {
  const value = next as ProductDeliveryType;
  if (value === deliveryType.value) return;
  if (editing.value) return;
  if (skuDrafts.value.some((s) => s.name && s.price !== "0.01")) {
    pendingDeliveryType.value = value;
    deliveryChangeDialogOpen.value = true;
    return;
  }
  deliveryType.value = value;
  skuDrafts.value.forEach((sku) => {
    sku.deliveryType = value;
  });
}

function confirmDeliveryTypeChange() {
  const next = pendingDeliveryType.value;
  if (!next) return;
  deliveryChanging.value = true;
  deliveryType.value = next;
  skuDrafts.value.forEach((sku, index) => {
    sku.name = `新规格${index + 1}`;
    sku.price = "0.01";
    sku.status = "ACTIVE";
    sku.deliveryType = next;
    sku.fixedDeliveryContent = "";
    sku.regionalPrices = emptyRegionalPrices();
    sku.physicalStock = next === "MANUAL" || next === "EXPRESS" ? 1 : null;
    sku.minBuy = 1;
    sku.maxBuy = 1;
  });
  deliveryChangeDialogOpen.value = false;
  pendingDeliveryType.value = null;
  deliveryChanging.value = false;
  toast.success("SKU 配置已清空，请重新填写。");
}

async function load() {
  loading.value = true;
  try {
    const catalog = await runTelefunc(() => onGetCatalogAdminData({ page: 1, pageSize: 20 }), { notifyError: false });
    categories.value = (catalog?.categories || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
    }));
    try {
      const tax = await runTelefunc(() => onGetProductTaxLinks({ productId: props.productId || 0 }), {
        notifyError: false,
      });
      taxTypeOptions.value = (tax as any)?.types || (tax as any)?.taxTypes || [];
      selectedTaxTypeIds.value = ((tax as any)?.linkedIds || (tax as any)?.productTaxTypeIds || []) as number[];
    } catch {
      taxTypeOptions.value = [];
    }
    if (props.productId) {
      const detail = await runTelefunc(() => onGetProductAdminDetail({ id: props.productId! }));
      resetForm({ values: productDetailToForm(detail.product) });
      const first = detail.skus?.[0];
      if (first?.deliveryType && first.deliveryType !== "SUPPLIER") {
        deliveryType.value = first.deliveryType as ProductDeliveryType;
      }
      skuDrafts.value = detail.skus.map((sku: any) => ({
        ...sku,
        productId: props.productId!,
        clientKey: `sku-${sku.id}`,
        fixedDeliveryContent: sku.fixedDeliveryContent ?? "",
        regionalPrices: normalizeRegionalForm(sku.regionalPrices),
      }));
    } else {
      resetForm({ values: defaultProductForm(activeCategories.value[0]?.id ?? null) });
      deliveryType.value = "CARD_AUTO";
      skuDrafts.value = [];
      addSku();
    }
  } catch {
    /* */
  } finally {
    loading.value = false;
  }
}

const submit = handleSubmit(async (form) => {
  saving.value = true;
  try {
    if (isSupplierProduct.value && props.productId) {
      await runTelefunc(
        () =>
          onSaveSupplierProductPresentation({
            id: props.productId!,
            categoryId: form.categoryId || null,
            name: form.name,
            slug: form.slug,
            subtitle: form.subtitle,
            coverImage: form.coverImage,
            description: form.description,
            nameEn: form.nameEn || null,
            subtitleEn: form.subtitleEn || null,
            descriptionEn: form.descriptionEn || null,
            seoTitleEn: form.seoTitleEn || null,
            seoDescriptionEn: form.seoDescriptionEn || null,
            purchaseNote: form.purchaseNote,
            status: form.status,
            sort: form.sort,
            skus: skuDrafts.value.map((sku) => ({
              id: sku.id!,
              name: sku.name,
              price: sku.price,
              status: sku.status,
              sort: sku.sort,
            })),
          }),
        { successMessage: "供应商商品已保存。" },
      );
    } else {
      const base = formToSaveInput(
        form,
        skuDrafts.value.map(({ id, productId: _pid, clientKey: _ck, fulfillmentSource: _fs, ...sku }) => ({
          ...sku,
          deliveryType: deliveryType.value,
          ...(editing.value && id ? { id } : {}),
        })),
        deliveryType.value,
      );
      await runTelefunc(
        () =>
          onSaveProduct({
            ...base,
            taxLinks: selectedTaxTypeIds.value.map((taxTypeId) => ({ taxTypeId })),
          }),
        { successMessage: props.productId ? "商品已保存。" : "商品已创建。" },
      );
    }
    goBack();
  } catch {
    /* */
  } finally {
    saving.value = false;
  }
});

onMounted(load);
</script>
