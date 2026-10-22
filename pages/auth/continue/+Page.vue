<template>
  <main class="flex min-h-screen items-center justify-center bg-muted/30 p-6">
    <p class="text-sm text-muted-foreground">正在完成登录...</p>
  </main>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

onMounted(() => {
  let target = "/";
  try {
    const redirect = sessionStorage.getItem("auth_redirect")?.trim();
    if (redirect) sessionStorage.removeItem("auth_redirect");
    if (
      redirect
      && redirect.startsWith("/")
      && !redirect.startsWith("//")
      && !redirect.startsWith("/login")
      && !redirect.startsWith("/signup")
      && !redirect.startsWith("/auth/")
    ) {
      target = redirect;
    }
  } catch {
    /* ignore storage errors */
  }
  window.location.replace(target);
});
</script>
