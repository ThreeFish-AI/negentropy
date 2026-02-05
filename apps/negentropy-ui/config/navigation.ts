export type NavItem = {
  title: string;
  href: string;
  disabled?: boolean;
};

export type MainNavItem = NavItem;

export const mainNavConfig: MainNavItem[] = [
  {
    title: "Chat",
    href: "/",
  },
  {
    title: "Knowledge",
    href: "/knowledge",
  },
];
