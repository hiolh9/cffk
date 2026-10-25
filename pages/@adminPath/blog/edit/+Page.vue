<template>
  <section class="flex w-full flex-col gap-6">
    <AdminPageHeader />

    <Alert v-if="loadError" variant="destructive">
      <AlertTitle>加载失败</AlertTitle>
      <AlertDescription>{{ loadError }}</AlertDescription>
    </Alert>

    <form class="flex max-w-4xl flex-col gap-5" @submit.prevent="save">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium">标题（页面唯一 H1）*</label>
          <Input v-model="form.title" required maxlength="200" placeholder="文章标题" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Slug（URL）*</label>
          <Input v-model="form.slug" required placeholder="how-to-top-up" />
          <p class="text-xs text-muted-foreground">仅小写字母、数字、连字符。前台地址：/blog/{{ form.slug || "..." }}</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">状态</label>
          <Select v-model="form.status">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">草稿</SelectItem>
              <SelectItem value="PUBLISHED">发布</SelectItem>
              <SelectItem value="ARCHIVED">归档</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium">摘要</label>
          <Input v-model="form.excerpt" maxlength="300" placeholder="列表与 SEO 描述备用" />
        </div>
        <div class="space-y-2 md:col-span-2">
          <label class="text-sm font-medium">正文 HTML *</label>
          <Textarea
            v-model="form.contentHtml"
            required
            rows="16"
            class="font-mono text-sm"
            placeholder="使用 h2/h3/p/ul/li，不要再写 h1。例如：&#10;<h2>步骤</h2>&#10;<p>...</p>&#10;<ul><li>要点一</li></ul>"
          />
          <p class="text-xs text-muted-foreground">标题已作为 H1；正文请从 H2 开始，列表用 ul/li，有利于 SEO。</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">封面图 URL</label>
          <Input v-model="form.coverImage" placeholder="https://..." />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">作者名</label>
          <Input v-model="form.authorName" placeholder="Sparkpay" />
        </div>
      </div>

      <div class="rounded-xl border p-4">
        <h2 class="text-sm font-semibold">SEO</h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="space-y-2 md:col-span-2">
            <label class="text-sm font-medium">SEO Title</label>
            <Input v-model="form.seoTitle" maxlength="70" placeholder="默认用文章标题" />
          </div>
          <div class="space-y-2 md:col-span-2">
            <label class="text-sm font-medium">SEO Description</label>
            <Textarea v-model="form.seoDescription" rows="2" maxlength="160" placeholder="默认用摘要" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Keywords</label>
            <Input v-model="form.seoKeywords" placeholder="top up, malaysia" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Canonical URL</label>
            <Input v-model="form.canonicalUrl" placeholder="留空则自动" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Schema 类型</label>
            <Select v-model="form.schemaType">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BlogPosting">BlogPosting</SelectItem>
                <SelectItem value="Article">Article</SelectItem>
                <SelectItem value="FAQPage">FAQPage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2 md:col-span-2">
            <label class="text-sm font-medium">FAQ JSON（FAQPage 或附加问答）</label>
            <Textarea
              v-model="form.faqJson"
              rows="4"
              class="font-mono text-xs"
              placeholder='[{"question":"How long?","answer":"Usually under 5 minutes."}]'
            />
          </div>
          <div class="space-y-2 md:col-span-2">
            <label class="text-sm font-medium">自定义 Schema JSON（高级，覆盖自动生成）</label>
            <Textarea
              v-model="form.customSchemaJson"
              rows="5"
              class="font-mono text-xs"
              placeholder="完整 JSON-LD 对象或数组；留空则用自动 BlogPosting/Article/FAQ"
            />
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <Button type="submit" :disabled="saving">{{ saving ? "保存中..." : "保存" }}</Button>
        <Button type="button" variant="outline" as-child>
          <a :href="`${basePath}/blog`">返回列表</a>
        </Button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import { toast } from "vue-sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import { onCreateBlogPost, onGetBlogPost, onUpdateBlogPost } from "@/server/blog/admin.telefunc";

const pageContext = usePageContext() as ReturnType<typeof usePageContext> & {
  urlParsed?: { search?: { id?: string } | Record<string, string> };
};
const basePath = computed(() => `/${pageContext.routeParams.adminPath}`);
const editId = computed(() => {
  const raw = pageContext.urlParsed?.search?.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
});

const form = reactive({
  title: "",
  slug: "",
  excerpt: "",
  contentHtml: "",
  coverImage: "",
  status: "DRAFT" as "DRAFT" | "PUBLISHED" | "ARCHIVED",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  canonicalUrl: "",
  schemaType: "BlogPosting" as "BlogPosting" | "Article" | "FAQPage",
  faqJson: "",
  customSchemaJson: "",
  authorName: "",
});

const saving = ref(false);
const loadError = ref("");

async function load() {
  if (!editId.value) return;
  try {
    const row = await runTelefunc(() => onGetBlogPost({ id: editId.value! }));
    form.title = row.title;
    form.slug = row.slug;
    form.excerpt = row.excerpt || "";
    form.contentHtml = row.contentHtml;
    form.coverImage = row.coverImage || "";
    form.status = row.status as typeof form.status;
    form.seoTitle = row.seoTitle || "";
    form.seoDescription = row.seoDescription || "";
    form.seoKeywords = row.seoKeywords || "";
    form.canonicalUrl = row.canonicalUrl || "";
    form.schemaType = row.schemaType as typeof form.schemaType;
    form.faqJson = row.faqJson || "";
    form.customSchemaJson = row.customSchemaJson || "";
    form.authorName = row.authorName || "";
  } catch (error) {
    loadError.value = userErrorMessage(error, "无法加载文章");
  }
}

async function save() {
  saving.value = true;
  try {
    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt || null,
      contentHtml: form.contentHtml,
      coverImage: form.coverImage || null,
      status: form.status,
      seoTitle: form.seoTitle || null,
      seoDescription: form.seoDescription || null,
      seoKeywords: form.seoKeywords || null,
      canonicalUrl: form.canonicalUrl || null,
      schemaType: form.schemaType,
      faqJson: form.faqJson || null,
      customSchemaJson: form.customSchemaJson || null,
      authorName: form.authorName || null,
    };
    if (editId.value) {
      await runTelefunc(() => onUpdateBlogPost({ id: editId.value!, ...payload }));
      toast.success("已保存");
    } else {
      const created = await runTelefunc(() => onCreateBlogPost(payload));
      toast.success("已创建");
      window.location.href = `${basePath.value}/blog/edit?id=${created.id}`;
      return;
    }
  } catch (error) {
    toast.error(userErrorMessage(error, "保存失败"));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>
