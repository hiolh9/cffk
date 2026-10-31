<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />
    <Alert variant="destructive">
      <AlertTitle>设置页临时精简</AlertTitle>
      <AlertDescription>
        完整设置页因构建解析错误被临时替换。请联系开发恢复完整表单，或从 Git 历史检出
        <code class="rounded bg-muted px-1">pages/@adminPath/system/settings/+Page.vue</code>
        （修复 FieldDescription 中裸写的 script 字样后）。
      </AlertDescription>
    </Alert>
  </section>
</template>

<script lang="ts" setup>
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
</script>
