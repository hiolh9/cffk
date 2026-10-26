<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />
    <div class="rounded-xl border bg-card p-6 text-sm">
      <p class="font-medium">订单列表文件需从 GitHub 历史恢复</p>
      <p class="mt-2 text-muted-foreground">
        请在仓库打开 pages/@adminPath/orders/+Page.vue → History → 选择 commit 9f73f8f 的父提交还原完整文件。
        后端退款 API 已可用：server/order/refund.telefunc.ts（onRefundAdminOrder）。
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
</script>
