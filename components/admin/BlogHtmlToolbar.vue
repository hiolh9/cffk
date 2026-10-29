<template>
  <div class="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
    <div class="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" @click="insertBlock('<h2>小标题</h2>\n')">H2</Button>
      <Button type="button" size="sm" variant="outline" @click="insertBlock('<h3>小节</h3>\n')">H3</Button>
      <Button type="button" size="sm" variant="outline" @click="insertBlock('<p></p>\n')">段落</Button>
      <Button type="button" size="sm" variant="outline" @click="insertBlock('<ul>\n  <li>要点</li>\n</ul>\n')">列表</Button>
      <Button type="button" size="sm" variant="secondary" @click="showImage = !showImage">插入图片</Button>
    </div>

    <div v-if="showImage" class="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-2">
      <div class="space-y-1 sm:col-span-2">
        <label class="text-xs font-medium">图片 URL *</label>
        <Input v-model="imageSrc" placeholder="https://... 或 /media/..." />
      </div>
      <div class="space-y-1 sm:col-span-2">
        <label class="text-xs font-medium">Alt 文本（SEO / 无障碍）*</label>
        <Input v-model="imageAlt" placeholder="描述图片内容，例如 Mobile Legends diamond top up" />
      </div>
      <div class="space-y-1 sm:col-span-2">
        <label class="text-xs font-medium">图注（可选）</label>
        <Input v-model="imageCaption" placeholder="显示在图片下方" />
      </div>
      <div class="sm:col-span-2 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" @click="showImage = false">取消</Button>
        <Button type="button" size="sm" :disabled="!canInsertImage" @click="insertImage">插入到正文</Button>
      </div>
    </div>

    <p class="text-xs text-muted-foreground">
      图片必须带 alt。插入的 HTML 形如
      <code class="rounded bg-muted px-1"><figure><img src="..." alt="..." loading="lazy" /></figure></code>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

const showImage = ref(false);
const imageSrc = ref("");
const imageAlt = ref("");
const imageCaption = ref("");

const canInsertImage = computed(() => Boolean(imageSrc.value.trim() && imageAlt.value.trim()));

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&")
    .replace(/"/g, """)
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function insertBlock(html: string) {
  const base = props.modelValue || "";
  const next = base.endsWith("\n") || !base ? `${base}${html}` : `${base}\n${html}`;
  emit("update:modelValue", next);
}

function insertImage() {
  if (!canInsertImage.value) return;
  const src = escapeAttr(imageSrc.value.trim());
  const alt = escapeAttr(imageAlt.value.trim());
  const caption = imageCaption.value.trim();
  const figcaption = caption
    ? `\n  <figcaption>${escapeAttr(caption)}</figcaption>`
    : "";
  const block = `<figure>\n  <img src="${src}" alt="${alt}" loading="lazy" />${figcaption}\n</figure>\n`;
  insertBlock(block);
  imageSrc.value = "";
  imageAlt.value = "";
  imageCaption.value = "";
  showImage.value = false;
}
</script>
