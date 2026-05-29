"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { type MainNavItem } from "@/config/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

interface MainNavProps {
  items?: MainNavItem[];
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
            const matchPaths = item.activePaths ?? [item.href];
            const isActive = matchPaths.some(
              (p) => (p === "/" ? pathname === "/" : pathname?.startsWith(p))
            );

            return (
              <Link
                key={index}
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
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
