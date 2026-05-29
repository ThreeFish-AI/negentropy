"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavigation } from "@/components/providers/NavigationProvider";

const NAV_ITEMS = [
  { href: "/knowledge/base", label: "Knowledge Base" },
  { href: "/knowledge/graph", label: "Knowledge Graph" },
  { href: "/knowledge/wiki", label: "Wiki", aliases: ["/knowledge/catalog"] },
  { href: "/knowledge/documents", label: "Documents" },
  { href: "/knowledge/apis", label: "APIs" },
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

  const isActive = (href: string, aliases?: string[]) =>
    pathname.startsWith(href) || (aliases?.some((a) => pathname.startsWith(a)) ?? false);

  return (
    <div className="border-b border-border bg-card px-6 py-1">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-full">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.aliases);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
