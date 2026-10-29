<template>
  <FieldSet class="gap-4">
    <FieldLegend>SEO 覆盖</FieldLegend>
    <FieldDescription>留空则使用商品名 / 副标题 / 系统默认 Product schema。</FieldDescription>
    <VeeField v-slot="{ componentField }" name="seoTitle">
      <Field>
        <FieldLabel for="product-seo-title">SEO Title</FieldLabel>
        <Input id="product-seo-title" v-bind="componentField" maxlength="70" placeholder="默认用商品名" />
        <FieldDescription>搜索结果标题，建议不超过 60 字符</FieldDescription>
      </Field>
    </VeeField>
    <VeeField v-slot="{ componentField }" name="seoDescription">
      <Field>
        <FieldLabel for="product-seo-desc">SEO Description</FieldLabel>
        <Textarea id="product-seo-desc" v-bind="componentField" rows="2" maxlength="160" placeholder="默认用副标题/详情纯文本" />
        <FieldDescription>meta description，建议 120–160 字符</FieldDescription>
      </Field>
    </VeeField>
    <VeeField v-slot="{ componentField }" name="seoKeywords">
      <Field>
        <FieldLabel for="product-seo-kw">SEO Keywords</FieldLabel>
        <Input id="product-seo-kw" v-bind="componentField" placeholder="top up, malaysia, game" />
      </Field>
    </VeeField>
    <VeeField v-slot="{ componentField }" name="customSchemaJson">
      <Field>
        <FieldLabel for="product-custom-schema">自定义 JSON-LD（可选）</FieldLabel>
        <Textarea
          id="product-custom-schema"
          v-bind="componentField"
          rows="5"
          class="font-mono text-xs"
          placeholder='留空用系统 schema；填写 JSON 对象或数组可覆盖'
        />
      </Field>
    </VeeField>
  </FieldSet>
</template>

<script setup lang="ts">
import { Field as VeeField } from "vee-validate";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
</script>
