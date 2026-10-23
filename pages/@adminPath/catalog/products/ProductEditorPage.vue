<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />
    <form class="grid gap-6" @submit.prevent="onSubmit">
      <FieldSet class="gap-4">
        <FieldLegend><span class="text-destructive">*</span> 基本信息</FieldLegend>
        <FieldGroup class="grid gap-4 sm:grid-cols-2">
          <VeeField v-slot="{ errors }" name="name">
            <Field :data-invalid="errors.length > 0">
              <FieldLabel>商品名称</FieldLabel>
              <Input v-model="values.name" @update:model-value="onNameChange" />
              <FieldError v-if="errors.length" :errors="errors" />
            </Field>
          </VeeField>
          <VeeField v-slot="{ errors }" name="slug">
            <Field :data-invalid="errors.length > 0">
              <FieldLabel>Slug</FieldLabel>
              <Input v-model="values.slug" />
              <FieldError v-if="errors.length" :errors="errors" />
            </Field>
          </VeeField>
          <VeeField v-slot="{ errors }" name="subtitle" class="sm:col-span-2">
            <Field :data-invalid="errors.length > 0">
              <FieldLabel>副标题</FieldLabel>
              <Input v-model="values.subtitle" />
              <FieldError v-if="errors.length" :errors="errors" />
            </Field>
          </VeeField>
          <VeeField v-slot="{ errors }" name="categoryId">
            <Field :data-invalid="errors.length > 0">
              <FieldLabel>分类</FieldLabel>
              <Select :model-value="values.categoryId" @update:model-value="(v) => setFieldValue('categoryId', String(v ?? ''))">
                <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</SelectItem>
                </SelectContent>
              </Select>
              <FieldError v-if="errors.length" :errors="errors" />
            </Field>
          </VeeField>
          <VeeField v-slot="{ errors }" name="status">
            <Field :data-invalid="errors.length > 0">
              <FieldLabel>状态</FieldLabel>
              <Select :model-value="values.status" @update:model-value="(v) => setFieldValue('status', String(v ?? 'DRAFT'))">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">上架</SelectItem>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                  <SelectItem value="ARCHIVED">归档</SelectItem>
                </SelectContent>
              </Select>
              <FieldError v-if="errors.length" :errors="errors" />
            </Field>
          </VeeField>
        </FieldGroup>
      </FieldSet>

      <FieldSet class="gap-4">
        <FieldLegend><span class="text-destructive">*</span> 商品详情</FieldLegend>
        <VeeField v-slot="{ errors }" name="description">
          <Field :data-invalid="errors.length > 0">
            <ProductRichTextEditor :model-value="values.description" @update:model-value="setFieldValue('description', $event)" />
            <FieldError v-if="errors.length" :errors="errors" />
          </Field>
        </VeeField>
      </FieldSet>

      <div class="flex flex-wrap gap-2">
        <Button type="submit" :disabled="saving">{{ saving ? "保存中..." : "保存商品" }}</Button>
        <Button type="button" variant="outline" @click="goBack">返回</Button>
      </div>
    </form>
  </section>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted, ref } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import { navigate } from "vike/client/router";
import { toast } from "vue-sonner";
import { toTypedSchema } from "@vee-validate/zod";
import { Field as VeeField, useForm } from "vee-validate";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { runTelefunc } from "@/lib/telefunc-client";
import { onGetCatalogAdminData, onGetProductAdminDetail, onSaveProduct } from "@/server/catalog/admin.telefunc";
import { defaultProductForm, formToSaveInput, productDetailToForm, productFormSchema, slugifyProductName, type ProductForm } from "./product-form";

const ProductRichTextEditor = defineAsyncComponent(() => import("./ProductRichTextEditor.vue"));

const pageContext = usePageContext();
const productId = computed(() => (pageContext.routeParams as { productId?: string }).productId);
const isCreate = computed(() => !productId.value || productId.value === "new");
const saving = ref(false);
const categories = ref<{ id: string; name: string }[]>([]);

const { values, setFieldValue, handleSubmit, setValues } = useForm<ProductForm>({
  validationSchema: toTypedSchema(productFormSchema),
  initialValues: defaultProductForm(),
});

function onNameChange(value: string | number) {
  const name = String(value ?? "");
  setFieldValue("name", name);
  if (isCreate.value || !values.slug) {
    setFieldValue("slug", slugifyProductName(name));
  }
}

const onSubmit = handleSubmit(async (form) => {
  saving.value = true;
  try {
    const result = await runTelefunc(() => onSaveProduct(formToSaveInput(form, productId.value)));
    toast.success("已保存");
    if (isCreate.value && result?.id) {
      await navigate(`/${pageContext.routeParams.adminPath}/catalog/products/${result.id}`);
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
});

function goBack() {
  void navigate(`/${pageContext.routeParams.adminPath}/catalog/products`);
}

onMounted(async () => {
  try {
    const catalog = await runTelefunc(() => onGetCatalogAdminData());
    categories.value = (catalog.categories ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
    if (!isCreate.value && productId.value) {
      const detail = await runTelefunc(() => onGetProductAdminDetail({ productId: productId.value! }));
      if (detail) setValues(productDetailToForm(detail));
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "加载失败");
  }
});
</script>
