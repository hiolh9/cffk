<template>
  <footer class="mt-auto border-t border-border/70 bg-muted/40">
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div class="min-w-0 space-y-3">
          <div class="flex items-center gap-2.5">
            <span class="flex size-9 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">SP</span>
            <span class="text-sm font-semibold text-foreground">Sparkpay Digital Services</span>
          </div>
          <p v-if="site.footerText" class="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
            {{ site.footerText }}
          </p>
          <p v-else class="text-sm leading-6 text-muted-foreground">
            Digital top-up &amp; game credits. Fast, secure checkout in RM.
          </p>
        </div>

        <div class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-foreground/80">Legal</h3>
          <nav class="flex flex-col gap-2 text-sm" aria-label="Legal">
            <a href="/privacy" class="w-fit text-muted-foreground transition-colors hover:text-brand">Privacy Policy / Dasar Privasi</a>
            <a href="/terms" class="w-fit text-muted-foreground transition-colors hover:text-brand">Terms of Use / Syarat Penggunaan</a>
            <a href="/sales" class="w-fit text-muted-foreground transition-colors hover:text-brand">Sales &amp; Refund / Jualan &amp; Bayaran Balik</a>
          </nav>
        </div>

        <div class="space-y-3 sm:col-span-2 lg:col-span-1">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-foreground/80">Support</h3>
          <p class="text-sm text-muted-foreground">Need help with an order? Contact us on WhatsApp.</p>
          <div class="flex flex-wrap gap-2">
            <template v-if="supportContacts.length">
              <a
                v-for="contact in supportContacts"
                :key="`${contact.label}-${contact.href}`"
                :href="contact.href"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-10 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-brand/40 hover:text-brand"
              >
                <HeadphonesIcon class="size-4 text-brand" />
                {{ contact.label }}
              </a>
            </template>
            <a
              v-else
              href="https://wa.me/60109349681"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <HeadphonesIcon class="size-4" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-col gap-2 border-t border-border/60 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {{ year }} Sparkpay Digital Services. Malaysia.</p>
        <p class="tabular-nums">Prices in RM · Digital goods only</p>
      </div>
    </div>
  </footer>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { HeadphonesIcon } from "@lucide/vue";
import { usePageContext } from "vike-vue/usePageContext";

type Site = {
  supportContact: string | null;
  footerText: string | null;
};

type SupportContact = {
  label: string;
  href: string;
};

const pageContext = usePageContext() as unknown as { site: Site };
const site = pageContext.site;
const year = new Date().getFullYear();

const supportContacts = computed<SupportContact[]>(() =>
  (site.supportContact ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf("|");
      const label = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
      const address = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;
      if (!label || !address) return null;
      return { label, href: address.includes(":") ? address : `mailto:${address}` };
    })
    .filter((contact): contact is SupportContact => contact !== null),
);
</script>
