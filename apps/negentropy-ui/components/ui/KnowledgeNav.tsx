"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/knowledge", label: "Dashboard" },
  { href: "/knowledge/base", label: "Knowledge Base" },
  { href: "/knowledge/graph", label: "Knowledge Graph" },
  { href: "/knowledge/pipelines", label: "Pipelines" },
  { href: "/knowledge/apis", label: "APIs" },
];

export function KnowledgeNav({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/knowledge"
      ? pathname === "/knowledge"
      : pathname.startsWith(href);

  return (
    <>
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">
                Knowledge
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <span className="font-semibold text-foreground">{title}</span>
            </div>
            {description && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            )}
          </div>

          <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-full">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    active
                      ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
