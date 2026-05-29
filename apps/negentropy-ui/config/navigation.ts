export type NavItem = {
  title: string;
  href: string;
  disabled?: boolean;
  /** 需要的角色列表，空数组或 undefined 表示所有人可见 */
  roles?: string[];
};

export type MainNavItem = NavItem & {
  /** Active 状态匹配路径前缀列表。未设置时默认为 [href] */
  activePaths?: string[];
};

export const mainNavConfig: MainNavItem[] = [
  {
    title: "Home",
    href: "/",
    activePaths: ["/", "/studio", "/dashboard"],
  },
  {
    title: "Knowledge",
    href: "/knowledge",
  },
  {
    title: "Memory",
    href: "/memory/timeline",
    activePaths: ["/memory"],
  },
  {
    title: "Interface",
    href: "/interface/agents",
    activePaths: ["/interface"],
  },
  {
    title: "Admin",
    href: "/admin",
    roles: ["admin"],
  },
];
