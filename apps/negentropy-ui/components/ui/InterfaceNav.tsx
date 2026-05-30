"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MCP_HUB_LABEL } from "@/app/interface/copy";
import { useNavigation } from "@/components/providers/NavigationProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/interface/agents", label: "Agents" },
  { href: "/interface/models", label: "Models", adminOnly: true },
  { href: "/interface/mcp", label: MCP_HUB_LABEL },
  { href: "/interface/skills", label: "Skills" },
  { href: "/interface/tools", label: "Tools" },
  { href: "/interface/scheduler", label: "Scheduler" },
];

export function InterfaceNav({
  title,
}: {
  title: string;
  description?: string;
}) {
  const pathname = usePathname();
  const { setNavigationInfo } = useNavigation();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;

  useEffect(() => {
    setNavigationInfo({ moduleLabel: "Interface", pageTitle: title });
    return () => {
      setNavigationInfo(null);
    };
  }, [title, setNavigationInfo]);

  const isActive = (href: string) => pathname.startsWith(href);

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="border-b border-border bg-card px-6 py-1">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <nav className={navRailContainerClassName}>
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={navPillClassName(isActive(item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
