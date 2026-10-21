<template>
  <main class="min-h-screen bg-background text-foreground">
    <header class="border-b">
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <a href="/" class="text-sm font-medium text-muted-foreground hover:text-foreground">← {{ backLabel }}</a>
        <div class="flex gap-1 rounded-md border p-0.5">
          <button
            type="button"
            class="rounded px-2.5 py-1 text-xs font-medium transition-colors"
            :class="lang === 'en' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'"
            @click="lang = 'en'"
          >
            EN
          </button>
          <button
            type="button"
            class="rounded px-2.5 py-1 text-xs font-medium transition-colors"
            :class="lang === 'ms' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'"
            @click="lang = 'ms'"
          >
            BM
          </button>
        </div>
      </div>
    </header>

    <article class="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <p class="text-xs text-muted-foreground">{{ updatedLabel }}: {{ doc.updated }}</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-tight">{{ title }}</h1>
      <nav class="mt-6 flex flex-wrap gap-3 border-b pb-4 text-sm">
        <a
          v-for="link in navLinks"
          :key="link.href"
          :href="link.href"
          class="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          :class="link.href === currentPath ? 'font-medium text-foreground' : ''"
        >
          {{ lang === 'en' ? link.labelEn : link.labelMs }}
        </a>
      </nav>

      <section v-for="(section, index) in sections" :key="index" class="mt-8">
        <h2 class="text-lg font-semibold tracking-tight">{{ section.heading }}</h2>
        <p v-for="(p, pi) in section.paragraphs" :key="pi" class="mt-3 text-sm leading-7 text-muted-foreground">
          {{ p }}
        </p>
        <ul v-if="section.bullets?.length" class="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
          <li v-for="(b, bi) in section.bullets" :key="bi">{{ b }}</li>
        </ul>
      </section>

      <p class="mt-12 text-xs text-muted-foreground">
        {{ disclaimer }}
      </p>
    </article>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { LegalDocument, LegalLang } from "@/lib/legal/policies";

const props = defineProps<{ doc: LegalDocument }>();

const lang = ref<LegalLang>("en");
const currentPath = computed(() => `/${props.doc.slug}`);
const title = computed(() => (lang.value === "en" ? props.doc.titleEn : props.doc.titleMs));
const sections = computed(() => (lang.value === "en" ? props.doc.sectionsEn : props.doc.sectionsMs));
const backLabel = computed(() => (lang.value === "en" ? "Home" : "Laman utama"));
const updatedLabel = computed(() => (lang.value === "en" ? "Last updated" : "Dikemas kini"));
const disclaimer = computed(() =>
  lang.value === "en"
    ? "This page is provided for transparency and general information. It is not formal legal advice."
    : "Halaman ini disediakan untuk ketelusan dan maklumat umum. Ia bukan nasihat undang-undang formal.",
);

const navLinks = [
  { href: "/privacy", labelEn: "Privacy Policy", labelMs: "Dasar Privasi" },
  { href: "/terms", labelEn: "Terms of Use", labelMs: "Syarat Penggunaan" },
  { href: "/sales", labelEn: "Sales & Refund", labelMs: "Jualan & Bayaran Balik" },
] as const;
</script>
