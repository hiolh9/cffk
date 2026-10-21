<template>
  <footer class="border-t bg-muted/40">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p v-if="site.footerText" class="min-w-0 whitespace-pre-wrap break-words">{{ site.footerText }}</p>
        <p v-else class="min-w-0">{{ messages.storefront?.footerFallback || "Sparkpay Digital Services" }}</p>
        <DropdownMenu v-if="supportContacts.length > 1">
          <DropdownMenuTrigger as-child>
            <Button type="button" variant="outline" size="sm" class="h-10 w-full shrink-0 bg-background shadow-none sm:h-9 sm:w-auto">
              <HeadphonesIcon data-icon="inline-start" />
              {{ messages.storefront.contactSupport }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="min-w-44 shadow-none">
            <DropdownMenuItem v-for="contact in supportContacts" :key="`${contact.label}-${contact.href}`" as-child>
              <a :href="contact.href" target="_blank" rel="noopener noreferrer">{{ contact.label }}</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <a
          v-else-if="supportContacts[0]"
          :href="supportContacts[0].href"
          class="inline-flex shrink-0 items-center gap-2 font-medium text-foreground hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          <HeadphonesIcon class="size-4" />
          {{ supportContacts[0].label }}
        </a>
      </div>
      <nav class="flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-xs" aria-label="Legal">
        <a href="/privacy" class="hover:text-foreground hover:underline">Privacy / Privasi</a>
        <a href="/terms" class="hover:text-foreground hover:underline">Terms / Syarat</a>
        <a href="/sales" class="hover:text-foreground hover:underline">Sales & Refund / Jualan</a>
      </nav>
    </div>
  </footer>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { HeadphonesIcon } from "@lucide/vue";
import { usePageContext } from "vike-vue/usePageContext";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStorefrontPreferences } from "@/lib/storefront-preferences";

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
const { messages } = useStorefrontPreferences();
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
