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
    <div className="border-b border-zinc-200 bg-white px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Admin</span>
            <span className="text-zinc-300">/</span>
            <span className="font-semibold text-zinc-900">{title}</span>
          </div>
          {description && (
            <p className="mt-1 text-xs text-zinc-500">{description}</p>
          )}
        </div>

        <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full border px-3 py-1 transition-colors ${
                isActive(item.href)
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900"
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
