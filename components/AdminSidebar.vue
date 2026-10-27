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
      <SidebarGroup>
        <SidebarGroupLabel>管理</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in flatItems" :key="item.path">
              <SidebarMenuButton as-child :is-active="isActive(item.path)">
                <a :href="basePath + item.path">
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
import { adminNavigation } from "@/lib/admin-navigation";
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
} from "lucide-vue-next";

const pageContext = usePageContext() as {
  urlPathname?: string;
  adminPath?: string;
  siteSettings?: { siteName?: string; logoUrl?: string | null };
};

const basePath = computed(() => {
  const p = pageContext.adminPath || "";
  return p.startsWith("/") ? p : `/${p}`;
});

const siteName = computed(() => pageContext.siteSettings?.siteName || "Sparkpay");
const logoUrl = computed(() => pageContext.siteSettings?.logoUrl || "/favicon.ico");

const flatItems = computed(() => {
  const nav = adminNavigation as Record<string, { title: string; path: string }>;
  const icons: Record<string, unknown> = {
    dashboard: LayoutDashboardIcon,
    catalog: PackageIcon,
    orders: ShoppingCartIcon,
    accounting: BookOpenIcon,
    settlements: BookOpenIcon,
    users: UsersIcon,
    blog: NewspaperIcon,
    push: BellIcon,
    system: SettingsIcon,
    suppliers: TruckIcon,
  };
  return Object.entries(nav)
    .filter(([, v]) => v && typeof v.path === "string")
    .map(([key, v]) => ({
      title: v.title,
      path: v.path,
      icon: icons[key],
    }));
});

function isActive(path: string) {
  const url = pageContext.urlPathname || "";
  return url.includes(path);
}
</script>
