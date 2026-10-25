<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />

    <Alert v-if="loadError" variant="destructive">
      <AlertTitle>读取文章失败</AlertTitle>
      <AlertDescription>{{ loadError }}</AlertDescription>
    </Alert>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <Input v-model="query" class="h-8 w-56" placeholder="搜索标题或 slug" @keyup.enter="load" />
        <Select v-model="statusFilter">
          <SelectTrigger size="sm" class="w-32"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="DRAFT">草稿</SelectItem>
            <SelectItem value="PUBLISHED">已发布</SelectItem>
            <SelectItem value="ARCHIVED">归档</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" :disabled="loading" @click="load">查询</Button>
      </div>
      <Button size="sm" as-child>
        <a :href="`${basePath}/blog/edit`"><PlusIcon />写文章</a>
      </Button>
    </div>

    <div class="overflow-hidden rounded-xl border bg-card">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th class="px-4 py-3 font-medium">标题</th>
            <th class="px-4 py-3 font-medium">Slug</th>
            <th class="px-4 py-3 font-medium">状态</th>
            <th class="px-4 py-3 font-medium">Schema</th>
            <th class="px-4 py-3 font-medium">更新</th>
            <th class="px-4 py-3 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id" class="border-b last:border-0">
            <td class="px-4 py-3 font-medium">{{ row.title }}</td>
            <td class="px-4 py-3 text-muted-foreground">{{ row.slug }}</td>
            <td class="px-4 py-3">
              <Badge :variant="row.status === 'PUBLISHED' ? 'default' : 'secondary'">{{ statusLabel(row.status) }}</Badge>
            </td>
            <td class="px-4 py-3 text-muted-foreground">{{ row.schemaType }}</td>
            <td class="px-4 py-3 text-muted-foreground">{{ formatDate(row.updatedAt) }}</td>
            <td class="px-4 py-3 text-right">
              <Button variant="ghost" size="sm" as-child>
                <a :href="`${basePath}/blog/edit?id=${row.id}`">编辑</a>
              </Button>
              <Button variant="ghost" size="sm" as-child>
                <a :href="`/blog/${row.slug}`" target="_blank" rel="noopener">预览</a>
              </Button>
              <Button variant="ghost" size="sm" class="text-destructive" :disabled="deletingId === row.id" @click="remove(row.id)">
                删除
              </Button>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td colspan="6" class="px-4 py-12 text-center text-muted-foreground">暂无文章</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { PlusIcon } from "@lucide/vue";
import { usePageContext } from "vike-vue/usePageContext";
import { toast } from "vue-sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import { onDeleteBlogPost, onListBlogPosts } from "@/server/blog/admin.telefunc";

type Row = {
  id: number;
  title: string;
  slug: string;
  status: string;
  schemaType: string;
  updatedAt: Date | string | number;
};

const pageContext = usePageContext();
const basePath = computed(() => `/${pageContext.routeParams.adminPath}`);
const items = ref<Row[]>([]);
const loading = ref(false);
const loadError = ref("");
const query = ref("");
const statusFilter = ref("ALL");
const deletingId = ref<number | null>(null);

function statusLabel(status: string) {
  if (status === "PUBLISHED") return "已发布";
  if (status === "ARCHIVED") return "归档";
  return "草稿";
}

function formatDate(value: Date | string | number) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", { hour12: false });
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await runTelefunc(() =>
      onListBlogPosts({
        query: query.value.trim() || undefined,
        status: statusFilter.value === "ALL" ? undefined : statusFilter.value,
      }),
    );
    items.value = result.items as Row[];
  } catch (error) {
    loadError.value = userErrorMessage(error, "无法加载文章列表");
  } finally {
    loading.value = false;
  }
}

async function remove(id: number) {
  if (!confirm("确定删除这篇文章？不可恢复。")) return;
  deletingId.value = id;
  try {
    await runTelefunc(() => onDeleteBlogPost({ id }));
    toast.success("已删除");
    await load();
  } catch (error) {
    toast.error(userErrorMessage(error, "删除失败"));
  } finally {
    deletingId.value = null;
  }
}

onMounted(() => {
  void load();
});
</script>
