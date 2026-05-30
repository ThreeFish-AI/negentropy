"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type MainNavItem } from "@/config/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";

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
        <nav className={navRailContainerClassName}>
          {visibleItems.map((item, index) => {
            const matchPaths = item.activePaths ?? [item.href];
            const active = matchPaths.some((p) =>
              p === "/" ? pathname === "/" : pathname?.startsWith(p),
            );

            return (
              <Link
                key={index}
                href={item.disabled ? "#" : item.href}
                className={navPillClassName(
                  active,
                  item.disabled ? "cursor-not-allowed opacity-80" : undefined,
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
