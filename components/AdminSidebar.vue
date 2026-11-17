<template>
  <aside class="flex h-full w-full flex-col border-r bg-card">
    <div class="flex h-14 items-center gap-2 border-b px-4">
      <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">SP</div>
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold">Admin</p>
        <p class="truncate text-xs text-muted-foreground">Sparkpay</p>
      </div>
    </div>
    <nav class="flex-1 overflow-y-auto p-3">
      <div v-for="group in groups" :key="group.title" class="mb-4">
        <p class="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ group.title }}</p>
        <ul class="space-y-0.5">
          <li v-for="item in group.items" :key="item.path">
            <a
              :href="adminHref(item.path)"
              class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors"
              :class="isActive(item.path) ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
            >
              <component :is="item.icon" class="size-4 shrink-0 opacity-80" />
              <span class="truncate">{{ item.title }}</span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import {
  BellIcon,
  BookOpenIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  NewspaperIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TagsIcon,
  TicketIcon,
  TruckIcon,
  UsersIcon,
} from "@lucide/vue";
import { computed } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import { adminPages } from "@/lib/admin-navigation";

const pageContext = usePageContext();

const adminBase = computed(() => {
  const path = pageContext.urlPathname || "/";
  const parts = path.split("/").filter(Boolean);
  // /{adminPath}/...
  return parts.length ? `/${parts[0]}` : "";
});

function adminHref(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${adminBase.value}${p}`;
}

function isActive(path: string) {
  const full = adminHref(path);
  const cur = pageContext.urlPathname || "";
  return cur === full || cur.startsWith(`${full}/`);
}

const groups = computed(() => [
  {
    title: "总览",
    items: [
      { title: adminPages.dashboard.title, path: adminPages.dashboard.path, icon: LayoutDashboardIcon },
      { title: adminPages.orders.title, path: adminPages.orders.path, icon: ShoppingCartIcon },
    ],
  },
  {
    title: "商品",
    items: [
      { title: adminPages.categories.title, path: adminPages.categories.path, icon: TagsIcon },
      { title: adminPages.products.title, path: adminPages.products.path, icon: PackageIcon },
      { title: adminPages.cards.title, path: adminPages.cards.path, icon: CreditCardIcon },
      { title: adminPages.discounts.title, path: adminPages.discounts.path, icon: TicketIcon },
    ],
  },
  {
    title: "供应商",
    items: [
      { title: adminPages.supplierAccounts.title, path: adminPages.supplierAccounts.path, icon: TruckIcon },
      { title: adminPages.supplierProducts.title, path: adminPages.supplierProducts.path, icon: PackageIcon },
      { title: adminPages.supplierOrders.title, path: adminPages.supplierOrders.path, icon: ShoppingCartIcon },
    ],
  },
  {
    title: "账务",
    items: [
      { title: adminPages.accounting.title, path: adminPages.accounting.path, icon: BookOpenIcon },
      { title: adminPages.settlements.title, path: adminPages.settlements.path, icon: BookOpenIcon },
      { title: adminPages.pnl.title, path: adminPages.pnl.path, icon: BookOpenIcon },
      { title: adminPages.tax.title, path: adminPages.tax.path, icon: BookOpenIcon },
      { title: adminPages.supplierWallet.title, path: adminPages.supplierWallet.path, icon: BookOpenIcon },
      { title: adminPages.taxNexus.title, path: adminPages.taxNexus.path, icon: BookOpenIcon },
    ],
  },
  {
    title: "内容",
    items: [
      { title: adminPages.users.title, path: adminPages.users.path, icon: UsersIcon },
      { title: adminPages.blog.title, path: adminPages.blog.path, icon: NewspaperIcon },
    ],
  },
  {
    title: "通知",
    items: [
      { title: adminPages.pushConfig.title, path: adminPages.pushConfig.path, icon: BellIcon },
      { title: adminPages.mailTemplates.title, path: adminPages.mailTemplates.path, icon: BellIcon },
      { title: adminPages.mailPostOffice.title, path: adminPages.mailPostOffice.path, icon: BellIcon },
      { title: adminPages.telegram.title, path: adminPages.telegram.path, icon: BellIcon },
      { title: adminPages.wecom.title, path: adminPages.wecom.path, icon: BellIcon },
      { title: adminPages.pushLogs.title, path: adminPages.pushLogs.path, icon: BellIcon },
    ],
  },
  {
    title: "系统",
    items: [
      { title: adminPages.payments.title, path: adminPages.payments.path, icon: SettingsIcon },
      { title: adminPages.media.title, path: adminPages.media.path, icon: SettingsIcon },
      { title: adminPages.settings.title, path: adminPages.settings.path, icon: SettingsIcon },
      { title: adminPages.regions.title, path: adminPages.regions.path, icon: SettingsIcon },
      { title: adminPages.risk.title, path: adminPages.risk.path, icon: SettingsIcon },
      { title: adminPages.security.title, path: adminPages.security.path, icon: SettingsIcon },
      { title: adminPages.tasks.title, path: adminPages.tasks.path, icon: SettingsIcon },
    ],
  },
]);
</script>
