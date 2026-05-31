"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavigation } from "@/components/providers/NavigationProvider";
import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";

// 标签顺序编码记忆生命周期叙事：Overview（地图）→ Formation → Evolution → Retrieval/可观测。
// Insights 对所有登录用户可见（健康 + 检索质量），其中系统聚合指标面板在页面内做 admin 渲染门控。
const NAV_ITEMS = [
  { href: "/memory/overview", label: "Overview" },
  { href: "/memory/timeline", label: "Timeline" },
  { href: "/memory/facts", label: "Facts" },
  { href: "/memory/conflicts", label: "Conflicts" },
  { href: "/memory/core-blocks", label: "Core Memory" },
  { href: "/memory/audit", label: "Audit" },
  { href: "/memory/insights", label: "Insights" },
];

export function MemoryNav({
  title,
}: {
  title: string;
  description?: string;
}) {
  const pathname = usePathname();
  const { setNavigationInfo } = useNavigation();

  useEffect(() => {
    setNavigationInfo({ moduleLabel: "Memory", pageTitle: title });
    return () => {
      setNavigationInfo(null);
    };
  }, [title, setNavigationInfo]);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="border-b border-border bg-card px-6 py-1">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <nav className={navRailContainerClassName}>
          {NAV_ITEMS.map((item) => (
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
