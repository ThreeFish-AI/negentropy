"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
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
  const prefersReduced = useReducedMotion();

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

            const link = (
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

            if (prefersReduced) return link;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: index * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {link}
              </motion.div>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
