export type AdminPageMeta = {
  title: string;
  path: string;
  pageTitle: string;
  description: string;
};

export type AdminNavigationModule = AdminPageMeta & {
  items: readonly AdminPageMeta[];
};

export type AdminNavigationItem = AdminPageMeta | AdminNavigationModule;

export type AdminNavigationGroup = {
  title: string;
  items: readonly AdminNavigationItem[];
};

export function isNavigationModule(item: AdminNavigationItem): item is AdminNavigationModule {
  return "items" in item;
}

const emailDescription = "管理邮件 Provider 和发送统计。";

export const adminPages = {
  account: {
    title: "账户设置",
    path: "/account",
    pageTitle: "账户设置",
    description: "修改当前管理员的昵称、邮箱和登录密码。",
  },
  dashboard: {
    title: "面板",
    path: "/dash",
    pageTitle: "运营面板",
    description: "当前店铺的真实运营汇总。",
  },
  categories: {
    title: "分类管理",
    path: "/catalog/categories",
    pageTitle: "分类管理",
    description: "管理商品分类、排序和启用状态。",
  },
  products: {
    title: "商品列表",
    path: "/catalog/products",
    pageTitle: "商品管理",
    description: "管理商品价格、分类、上下架状态和购买限制。",
  },
  productNew: {
    title: "添加商品",
    path: "/catalog/products/new",
    pageTitle: "添加商品",
    description: "完整配置商品信息、发货规则和发布状态。",
  },
  productEdit: {
    title: "编辑商品",
    path: "/catalog/products/:id",
    pageTitle: "编辑商品",
    description: "编辑商品信息、发货规则和发布状态。",
  },
  cards: {
    title: "卡密管理",
    path: "/catalog/cards",
    pageTitle: "卡密管理",
    description: "管理自动发货商品的卡密库存、批次与发售状态。",
  },
  discounts: {
    title: "优惠券管理",
    path: "/catalog/discounts",
    pageTitle: "优惠券管理",
    description: "创建优惠规则、限制使用次数和适用商品。",
  },
  supplierAccounts: {
    title: "供应商账号",
    path: "/suppliers/accounts",
    pageTitle: "供应商账号",
    description: "管理上游账号、余额与连接状态（含 MooGold）。",
  },
  supplierProducts: {
    title: "供应商商品",
    path: "/suppliers/products",
    pageTitle: "供应商商品",
    description: "查看上游商品、SKU、库存和成本，并同步已绑定货源。",
  },
  supplierOrders: {
    title: "供应商订单",
    path: "/suppliers/orders",
    pageTitle: "供应商订单",
    description: "查看采购状态、成本、错误并执行重试、对账和账号重选。",
  },
  orders: {
    title: "订单管理",
    path: "/orders",
    pageTitle: "订单管理",
    description: "查看订单、关闭未支付订单，并处理人工、物流及自动发货恢复。",
  },
  accounting: {
    title: "账本对账",
    path: "/accounting",
    pageTitle: "账本对账",
    description: "Gross/Fee/Net/COGS 账本、CSV 导出、银行直转手动开单与审计。",
  },
  settlements: {
    title: "网关结算",
    path: "/accounting/settlements",
    pageTitle: "网关批量结算",
    description: "录入网关批次到账、关联订单、计算已实现汇兑损益。",
  },
  pnl: {
    title: "日记账与P&L",
    path: "/accounting/pnl",
    pageTitle: "日记账与月度损益",
    description: "非订单流水（费用/预存/提款）与按月生成 P&L、一键导出。",
  },
  users: {
    title: "用户管理",
    path: "/users",
    pageTitle: "用户管理",
    description: "查看注册用户与状态。",
  },
  blog: {
    title: "博客",
    path: "/blog",
    pageTitle: "博客管理",
    description: "撰写与发布 SEO 文章。",
  },
  blogEdit: {
    title: "编辑文章",
    path: "/blog/edit",
    pageTitle: "编辑文章",
    description: "编辑博客正文与 SEO 字段。",
  },
  pushConfig: {
    title: "推送总览",
    path: "/push",
    pageTitle: "推送总览",
    description: "查看推送渠道与策略概览。",
  },
  pushLogs: {
    title: "推送日志",
    path: "/push/logs",
    pageTitle: "推送日志",
    description: "查看历史推送记录。",
  },
  email: {
    title: "邮件",
    path: "/push/email",
    pageTitle: "邮件设置",
    description: "管理邮件 Provider 和发送统计。",
  },
  mailTemplates: {
    title: "邮件模板",
    path: "/push/templates",
    pageTitle: "邮件模板",
    description: "管理订单与系统邮件模板。",
  },
  mailPostOffice: {
    title: "邮局",
    path: "/push/post-office",
    pageTitle: "邮局",
    description: "查看待发与失败邮件。",
  },
  wecom: {
    title: "企业微信",
    path: "/push/wecom",
    pageTitle: "企业微信",
    description: "配置企业微信通知。",
  },
  telegram: {
    title: "Telegram",
    path: "/push/telegram",
    pageTitle: "Telegram",
    description: "配置 Telegram 推送渠道。",
  },
  payments: {
    title: "支付配置",
    path: "/system/payments",
    pageTitle: "支付配置",
    description: "管理支付网关与渠道。",
  },
  paymentLogs: {
    title: "支付日志",
    path: "/system/payments/payment-logs",
    pageTitle: "支付日志",
    description: "查看支付回调与对账日志。",
  },
  media: {
    title: "媒体库",
    path: "/system/media",
    pageTitle: "媒体库",
    description: "管理上传图片与资源。",
  },
  settings: {
    title: "站点设置",
    path: "/system/settings",
    pageTitle: "站点设置",
    description: "站点名称、域名与基础开关。",
  },
  risk: {
    title: "风控",
    path: "/system/risk",
    pageTitle: "风控设置",
    description: "限额、黑名单与行为分。",
  },
  security: {
    title: "安全",
    path: "/system/security",
    pageTitle: "安全设置",
    description: "管理员 IP、2FA 与登录保护。",
  },
  tasks: {
    title: "定时任务",
    path: "/system/tasks",
    pageTitle: "定时任务",
    description: "查看计划任务执行情况。",
  },
} as const satisfies Record<string, AdminPageMeta>;

export const adminNavigation = {
  account: adminPages.account,
  dashboard: adminPages.dashboard,
  categories: adminPages.categories,
  products: adminPages.products,
  productNew: adminPages.productNew,
  productEdit: adminPages.productEdit,
  cards: adminPages.cards,
  discounts: adminPages.discounts,
  supplierAccounts: adminPages.supplierAccounts,
  supplierProducts: adminPages.supplierProducts,
  supplierOrders: adminPages.supplierOrders,
  orders: adminPages.orders,
  accounting: adminPages.accounting,
  settlements: adminPages.settlements,
  pnl: adminPages.pnl,
  users: adminPages.users,
  blog: adminPages.blog,
  blogEdit: adminPages.blogEdit,
  pushConfig: adminPages.pushConfig,
  pushLogs: adminPages.pushLogs,
  email: adminPages.email,
  mailTemplates: adminPages.mailTemplates,
  mailPostOffice: adminPages.mailPostOffice,
  wecom: adminPages.wecom,
  telegram: adminPages.telegram,
  payments: adminPages.payments,
  paymentLogs: adminPages.paymentLogs,
  media: adminPages.media,
  settings: adminPages.settings,
  risk: adminPages.risk,
  security: adminPages.security,
  tasks: adminPages.tasks,
  product: {
    title: "商品中心",
    items: [
      adminPages.categories,
      adminPages.products,
      adminPages.cards,
      adminPages.discounts,
    ],
  },
  suppliers: {
    title: "供应商",
    items: [adminPages.supplierAccounts, adminPages.supplierProducts, adminPages.supplierOrders],
  },
  push: {
    title: "推送管理",
    items: [
      adminPages.pushConfig,
      adminPages.mailTemplates,
      { ...adminPages.email, items: [adminPages.mailPostOffice] },
      adminPages.wecom,
      adminPages.telegram,
      adminPages.pushLogs,
    ],
  },
  system: {
    title: "系统配置",
    items: [
      adminPages.payments,
      adminPages.paymentLogs,
      adminPages.media,
      adminPages.settings,
      adminPages.risk,
      adminPages.security,
      adminPages.tasks,
    ],
  },
} as const satisfies Record<string, AdminPageMeta | AdminNavigationGroup>;

const navigationGroups: readonly AdminNavigationGroup[] = [
  adminNavigation.product,
  adminNavigation.suppliers,
  adminNavigation.push,
  adminNavigation.system,
];

const allAdminPages = Object.values(adminPages) as readonly AdminPageMeta[];

export function getAdminPageMeta(pathname: string, basePath: string) {
  const routePath = pathname.slice(basePath.length).replace(/\/$/, "") || "/";
  return (
    allAdminPages.find((page) => page.path === routePath) ??
    (routePath.startsWith("/catalog/products/") ? adminPages.productEdit : undefined) ??
    (routePath.startsWith("/blog/edit") ? adminPages.blogEdit : undefined)
  );
}

export function isAdminNavigationItemActive(pathname: string, basePath: string, item: AdminNavigationItem) {
  const target = `${basePath}${item.path}`;
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function getAdminBreadcrumb(pathname: string, basePath: string) {
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (!isAdminNavigationItemActive(pathname, basePath, item)) continue;
      if (isNavigationModule(item)) {
        const child = item.items.find((candidate) =>
          isAdminNavigationItemActive(pathname, basePath, candidate),
        );
        return { titles: child ? [group.title, item.title, child.title] : [group.title, item.title] };
      }
      return { titles: [group.title, item.title] };
    }
  }

  const standaloneItems = [
    adminNavigation.dashboard,
    adminNavigation.orders,
    adminNavigation.accounting,
    adminNavigation.settlements,
    adminNavigation.pnl,
    adminNavigation.users,
    adminNavigation.blog,
    adminPages.blogEdit,
    adminPages.account,
  ];
  const standalone = standaloneItems.find((item) => isAdminNavigationItemActive(pathname, basePath, item));
  if (standalone) return { titles: [standalone.title] };

  const page = getAdminPageMeta(pathname, basePath);
  return { titles: [page?.title ?? "管理后台"] };
}
