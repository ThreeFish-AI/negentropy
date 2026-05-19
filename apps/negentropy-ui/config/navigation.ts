export type NavItem = {
  title: string;
  href: string;
  disabled?: boolean;
  /** 需要的角色列表，空数组或 undefined 表示所有人可见 */
  roles?: string[];
};

export type MainNavItem = NavItem;

export const mainNavConfig: MainNavItem[] = [
  {
    title: "Home",
    href: "/",
  },
  {
    title: "Knowledge",
    href: "/knowledge",
  },
  {
    title: "Memory",
    href: "/memory/timeline",
  },
  {
    title: "Interface",
    href: "/interface/subagents",
  },
  {
    title: "Admin",
    href: "/admin",
    roles: ["admin"],
  },
];
