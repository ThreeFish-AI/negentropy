"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Users" },
  { href: "/admin/roles", label: "Role Management" },
];

export function AdminNav({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="border-b border-border bg-card px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Admin</span>
            <span className="text-border-muted">/</span>
            <span className="font-semibold text-foreground">{title}</span>
          </div>
          {description && (
            <p className="mt-1 text-xs text-muted">{description}</p>
          )}
        </div>

        <nav className="flex flex-wrap items-center gap-1 bg-muted/50 p-1 rounded-full">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isActive(item.href)
                  ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
