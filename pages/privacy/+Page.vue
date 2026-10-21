<template>
  <LegalDocumentPage :doc="privacyPolicy" />
</template>

<script setup lang="ts">
import LegalDocumentPage from "@/components/storefront/LegalDocumentPage.vue";
import { privacyPolicy } from "@/lib/legal/policies";
</script>
