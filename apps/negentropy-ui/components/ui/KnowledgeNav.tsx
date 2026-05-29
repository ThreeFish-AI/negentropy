"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavigation } from "@/components/providers/NavigationProvider";
import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";

const NAV_ITEMS = [
  { href: "/knowledge/base", label: "Knowledge Base" },
  { href: "/knowledge/graph", label: "Knowledge Graph" },
  { href: "/knowledge/documents", label: "Documents" },
  { href: "/knowledge/apis", label: "APIs" },
  { href: "/knowledge/wiki", label: "Wiki" },
  { href: "/knowledge/pipelines", label: "Pipelines" },
];

export function KnowledgeNav({
  title,
}: {
  title: string;
  description?: string;
}) {
  const pathname = usePathname();
  const { setNavigationInfo } = useNavigation();

  useEffect(() => {
    setNavigationInfo({ moduleLabel: "Knowledge", pageTitle: title });
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
