<template>
  <!-- Head/footer HTML is applied via DOM in onMounted (scripts must be recreated). -->
  <span class="hidden" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import { injectSiteCodes } from "@/lib/site-code-inject";

type Site = {
  headCode?: string | null;
  footerCode?: string | null;
};

const pageContext = usePageContext() as unknown as {
  site?: Site;
  routeParams?: { adminPath?: string };
  urlPathname?: string;
};

function shouldInject() {
  // Skip admin console — avoid third-party scripts on sensitive pages
  if (pageContext.routeParams?.adminPath) return false;
  const path = pageContext.urlPathname || "";
  if (path === "/setup" || path.startsWith("/auth/")) return false;
  return true;
}

function run() {
  if (!shouldInject()) return;
  injectSiteCodes({
    headCode: pageContext.site?.headCode,
    footerCode: pageContext.site?.footerCode,
  });
}

onMounted(run);
watch(
  () => [pageContext.site?.headCode, pageContext.site?.footerCode, pageContext.urlPathname],
  () => run(),
);
</script>
