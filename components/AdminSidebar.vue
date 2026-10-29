<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" class="h-14">
            <img :src="logoUrl" alt="Logo" class="aspect-square size-10 rounded-lg object-contain" />
            <div class="grid flex-1 text-left leading-tight">
              <span class="truncate text-sm font-semibold">{{ siteName }}</span>
              <span class="truncate text-xs">系统管理后台</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup v-for="group in menuGroups" :key="group.title">
        <SidebarGroupLabel>{{ group.title }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in group.items" :key="item.path">
              <SidebarMenuButton as-child :is-active="isActive(item.path)">
                <a :href="hrefFor(item.path)">
                  <component :is="item.icon" v-if="item.icon" />
                  <span>{{ item.title }}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton as-child :is-active="isActive('/account')">
            <a :href="hrefFor('/account')">账户设置</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton as-child>
            <a href="/">返回前台</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { adminPages } from "@/lib/admin-navigation";
import {
  LayoutDashboardIcon,
  PackageIcon,
  ShoppingCartIcon,
  BookOpenIcon,
  UsersIcon,
  NewspaperIcon,
  BellIcon,
  SettingsIcon,
  TruckIcon,
  TagsIcon,
  TicketIcon,
  CreditCardIcon,
} from "@lucide/vue";

type MenuItem = { title: string; path: string; icon?: unknown };

const pageContext = usePageContext() as {
  urlPathname?: string;
  adminPath?: string;
  routeParams?: { adminPath?: string };
  site?: { name?: string; logo?: string | null; logoIcon?: string | null };
  siteSettings?: { siteName?: string; logoUrl?: string | null };
};

/** Always `/{adminPath}` — never bare `/account` */
const basePath = computed(() => {
  const raw =
    pageContext.routeParams?.adminPath ||
    pageContext.adminPath ||
    "";
  const cleaned = String(raw).replace(/^\/+|\/+$/g, "");
  return cleaned ? `/${cleaned}` : "";
});

const siteName = computed(
  () => pageContext.site?.name || pageContext.siteSettings?.siteName || "Sparkpay",
);
const logoUrl = computed(
  () =>
    pageContext.site?.logoIcon ||
    pageContext.site?.logo ||
    pageContext.siteSettings?.logoUrl ||
    "/favicon.ico",
);

function hrefFor(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${basePath.value}${p}`;
}

function isActive(path: string) {
  const url = pageContext.urlPathname || "";
  const full = hrefFor(path);
  return url === full || url.startsWith(`${full}/`);
}

const menuGroups = computed(() => {
  const g = (title: string, items: MenuItem[]) => ({ title, items });
  return [
    g("总览", [
      { title: adminPages.dashboard.title, path: adminPages.dashboard.path, icon: LayoutDashboardIcon },
      { title: adminPages.orders.title, path: adminPages.orders.path, icon: ShoppingCartIcon },
    ]),
    g("商品", [
      { title: adminPages.categories.title, path: adminPages.categories.path, icon: TagsIcon },
      { title: adminPages.products.title, path: adminPages.products.path, icon: PackageIcon },
      { title: adminPages.cards.title, path: adminPages.cards.path, icon: CreditCardIcon },
      { title: adminPages.discounts.title, path: adminPages.discounts.path, icon: TicketIcon },
    ]),
    g("供应商", [
      { title: adminPages.supplierAccounts.title, path: adminPages.supplierAccounts.path, icon: TruckIcon },
      { title: adminPages.supplierProducts.title, path: adminPages.supplierProducts.path, icon: PackageIcon },
      { title: adminPages.supplierOrders.title, path: adminPages.supplierOrders.path, icon: ShoppingCartIcon },
    ]),
    g("财务", [
      { title: adminPages.accounting.title, path: adminPages.accounting.path, icon: BookOpenIcon },
      { title: adminPages.settlements.title, path: adminPages.settlements.path, icon: BookOpenIcon },
      { title: adminPages.pnl.title, path: adminPages.pnl.path, icon: BookOpenIcon },
    ]),
    g("用户与内容", [
      { title: adminPages.users.title, path: adminPages.users.path, icon: UsersIcon },
      { title: adminPages.blog.title, path: adminPages.blog.path, icon: NewspaperIcon },
    ]),
    g("推送", [
      { title: adminPages.pushConfig.title, path: adminPages.pushConfig.path, icon: BellIcon },
      { title: adminPages.mailTemplates.title, path: adminPages.mailTemplates.path, icon: BellIcon },
      { title: adminPages.mailPostOffice.title, path: adminPages.mailPostOffice.path, icon: BellIcon },
      { title: adminPages.telegram.title, path: adminPages.telegram.path, icon: BellIcon },
      { title: adminPages.wecom.title, path: adminPages.wecom.path, icon: BellIcon },
      { title: adminPages.pushLogs.title, path: adminPages.pushLogs.path, icon: BellIcon },
    ]),
    g("系统", [
      { title: adminPages.payments.title, path: adminPages.payments.path, icon: SettingsIcon },
      { title: adminPages.media.title, path: adminPages.media.path, icon: SettingsIcon },
      { title: adminPages.settings.title, path: adminPages.settings.path, icon: SettingsIcon },
      { title: adminPages.risk.title, path: adminPages.risk.path, icon: SettingsIcon },
      { title: adminPages.security.title, path: adminPages.security.path, icon: SettingsIcon },
      { title: adminPages.tasks.title, path: adminPages.tasks.path, icon: SettingsIcon },
    ]),
  ];
});
</script>
