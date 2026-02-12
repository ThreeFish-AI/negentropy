"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/memory", label: "Dashboard" },
  { href: "/memory/timeline", label: "Timeline" },
  { href: "/memory/facts", label: "Facts" },
  { href: "/memory/audit", label: "Audit" },
];

export function MemoryNav({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/memory" ? pathname === "/memory" : pathname.startsWith(href);

  return (
    <>
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Memory</span>
              <span className="text-border-muted">/</span>
              <span className="font-semibold text-foreground">{title}</span>
            </div>
            {description && (
              <p className="mt-1 text-xs text-muted">{description}</p>
            )}
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full border px-3 py-1 transition-colors ${
                  isActive(item.href)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-text-secondary hover:border-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
