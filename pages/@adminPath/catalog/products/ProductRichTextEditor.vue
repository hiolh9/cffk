<template>
  <div class="grid gap-2 rounded-md border p-2">
    <div class="flex flex-wrap items-center gap-1 border-b pb-2">
      <Button
        v-for="item in formatTools"
        :key="item.label"
        type="button"
        variant="ghost"
        size="icon-sm"
        :class="item.active?.() ? 'bg-accent text-accent-foreground' : ''"
        :aria-label="item.label"
        :title="item.label"
        :disabled="!editor || htmlMode"
        @mousedown.prevent
        @click="item.action"
      >
        <component :is="item.icon" />
      </Button>
      <Separator orientation="vertical" class="mx-1 hidden h-6 sm:block" />
      <Button type="button" variant="ghost" size="icon-sm" :disabled="!editor || htmlMode" aria-label="链接" title="链接" @click="promptLink">
        <LinkIcon />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" :disabled="htmlMode" aria-label="图片" title="图片" @click="pickerOpen = true">
        <ImageIcon />
      </Button>
      <Button type="button" variant="ghost" size="sm" class="ml-auto" @click="htmlMode = !htmlMode">
        {{ htmlMode ? "可视化" : "HTML" }}
      </Button>
    </div>

    <EditorContent v-if="editor && !htmlMode" :editor="editor" class="product-editor-content min-h-48 px-2 py-1" />
    <Textarea
      v-else
      :model-value="modelValue"
      :rows="12"
      class="min-h-48 font-mono text-sm"
      @update:model-value="onHtmlInput"
    />

    <MediaPickerDialog v-model:open="pickerOpen" @select="insertImage" />
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import {
  BoldIcon,
  Heading1Icon,
  Heading2Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  StrikethroughIcon,
} from "@lucide/vue";
import MediaPickerDialog from "@/components/admin/MediaPickerDialog.vue";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const htmlMode = ref(false);
const pickerOpen = ref(false);

const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false }),
    Image,
    Placeholder.configure({ placeholder: "编写商品详情..." }),
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
  ],
  content: props.modelValue || "",
  onUpdate: ({ editor: ed }) => {
    emit("update:modelValue", ed.getHTML());
  },
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return;
    const current = editor.value.getHTML();
    if (value !== current && value !== editor.value.getText()) {
      editor.value.commands.setContent(value || "", { emitUpdate: false });
    }
  },
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});

const formatTools = computed(() => [
  { label: "粗体", icon: BoldIcon, action: () => editor.value?.chain().focus().toggleBold().run(), active: () => editor.value?.isActive("bold") },
  { label: "斜体", icon: ItalicIcon, action: () => editor.value?.chain().focus().toggleItalic().run(), active: () => editor.value?.isActive("italic") },
  { label: "删除线", icon: StrikethroughIcon, action: () => editor.value?.chain().focus().toggleStrike().run(), active: () => editor.value?.isActive("strike") },
  { label: "标题1", icon: Heading1Icon, action: () => editor.value?.chain().focus().toggleHeading({ level: 1 }).run(), active: () => editor.value?.isActive("heading", { level: 1 }) },
  { label: "标题2", icon: Heading2Icon, action: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(), active: () => editor.value?.isActive("heading", { level: 2 }) },
  { label: "无序列表", icon: ListIcon, action: () => editor.value?.chain().focus().toggleBulletList().run(), active: () => editor.value?.isActive("bulletList") },
  { label: "有序列表", icon: ListOrderedIcon, action: () => editor.value?.chain().focus().toggleOrderedList().run(), active: () => editor.value?.isActive("orderedList") },
]);

function onHtmlInput(value: string | number) {
  const html = String(value ?? "");
  emit("update:modelValue", html);
  editor.value?.commands.setContent(html, { emitUpdate: false });
}

function promptLink() {
  const previous = editor.value?.getAttributes("link").href as string | undefined;
  const url = window.prompt("链接地址", previous || "https://");
  if (url === null) return;
  if (!url) {
    editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.value?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}

function insertImage(url: string) {
  if (!url) return;
  editor.value?.chain().focus().setImage({ src: url }).run();
  pickerOpen.value = false;
}
</script>

<style>
.product-editor-content .ProseMirror {
  min-height: 12rem;
  outline: none;
}
.product-editor-content .ProseMirror p.is-editor-empty:first-child::before {
  color: hsl(var(--muted-foreground));
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
.product-editor-content .ProseMirror img {
  max-width: 100%;
  height: auto;
}
</style>
