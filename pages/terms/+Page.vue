<template>
  <LegalDocumentPage :doc="termsOfUse" />
</template>

<script setup lang="ts">
import LegalDocumentPage from "@/components/storefront/LegalDocumentPage.vue";
import { termsOfUse } from "@/lib/legal/policies";
</script>
