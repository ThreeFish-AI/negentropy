"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavItem } from "@/config/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

interface MainNavProps {
  items?: NavItem[];
}

export function MainNav({ items }: MainNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  // Filter items based on user roles
  const visibleItems = items?.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some((role) => user?.roles?.includes(role));
  });

  return (
    <div className="flex gap-6 md:gap-10">
      {visibleItems?.length ? (
        <nav className="flex items-center gap-1 bg-zinc-100/50 p-1 rounded-full dark:bg-zinc-800/50">
          {visibleItems.map((item, index) => {
            // Logic to determine active state.
            // For "/", it matches exactly or if strictly root.
            // For others, startsWith.
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={index}
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                  item.disabled && "cursor-not-allowed opacity-80",
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
