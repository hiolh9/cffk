<template>
  <LegalDocumentPage :doc="salesTerms" />
</template>

<script setup lang="ts">
import LegalDocumentPage from "@/components/storefront/LegalDocumentPage.vue";
import { salesTerms } from "@/lib/legal/policies";
</script>
