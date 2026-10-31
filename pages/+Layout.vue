<template>
  <slot />
  <SiteCodeInject />
  <Toaster rich-colors position="top-right" :offset="16" />
</template>

<script setup lang="ts">
import { Toaster } from "vue-sonner";
import "vue-sonner/style.css";
import SiteCodeInject from "@/components/storefront/SiteCodeInject.vue";
import "./tailwind.css";
</script>
