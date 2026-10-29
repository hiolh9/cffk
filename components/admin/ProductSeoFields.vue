<template>
  <FieldSet class="gap-4">
    <FieldLegend>SEO overrides</FieldLegend>
    <FieldDescription>Leave empty to use product name / subtitle / default Product schema.</FieldDescription>
    <VeeField v-slot="{ componentField }" name="seoTitle">
      <Field>
        <FieldLabel for="product-seo-title">SEO Title</FieldLabel>
        <Input id="product-seo-title" v-bind="componentField" maxlength="70" placeholder="Default: product name" />
      </Field>
    </VeeField>
    <VeeField v-slot="{ componentField }" name="seoDescription">
      <Field>
        <FieldLabel for="product-seo-desc">SEO Description</FieldLabel>
        <Textarea id="product-seo-desc" v-bind="componentField" rows="2" maxlength="160" placeholder="Default: subtitle" />
      </Field>
    </VeeField>
    <VeeField v-slot="{ componentField }" name="seoKeywords">
      <Field>
        <FieldLabel for="product-seo-kw">SEO Keywords</FieldLabel>
        <Input id="product-seo-kw" v-bind="componentField" placeholder="top up, malaysia" />
      </Field>
    </VeeField>
    <VeeField v-slot="{ componentField }" name="customSchemaJson">
      <Field>
        <FieldLabel for="product-custom-schema">Custom JSON-LD (optional)</FieldLabel>
        <Textarea
          id="product-custom-schema"
          v-bind="componentField"
          rows="5"
          class="font-mono text-xs"
          placeholder="Leave empty for auto schema"
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
