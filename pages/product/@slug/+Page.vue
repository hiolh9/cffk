<template>
  <main class="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
    <header class="fixed inset-x-0 top-0 z-50 border-b bg-background">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="/" class="text-sm font-semibold tracking-tight">Sparkpay</a>
        <nav class="flex items-center gap-2 text-sm">
          <a href="/" class="text-muted-foreground hover:text-foreground">Home</a>
          <a href="/account" class="text-muted-foreground hover:text-foreground">Account</a>
        </nav>
      </div>
    </header>
    <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 overflow-y-auto px-4 pb-24 pt-20">
      <p class="text-sm text-muted-foreground">Product page is being restored. Please use the previous commit if checkout is needed, or redeploy after the full page file is restored from CDN commit cb071492.</p>
      <p class="text-xs text-muted-foreground">Idempotency and webhook event dedupe are live on the server; only this Vue page file was truncated during push and needs the full UI restored.</p>
    </div>
  </main>
</template>
<script setup lang="ts">
// Temporary notice page — full product UI must be restored from:
// https://cdn.jsdelivr.net/gh/hiolh9/cffk@cb071492ef9e6c474aea0d92dc4a4b91fe9ce5d2/pages/product/@slug/+Page.vue
// then add idempotencyKey to onCreatePayment as documented in server/payment/checkout.telefunc.ts
</script>
