"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavItem } from "@/config/navigation";

interface MainNavProps {
  items?: NavItem[];
}

export function MainNav({ items }: MainNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6 md:gap-10">
      {items?.length ? (
        <nav className="flex items-center gap-1 bg-zinc-100/50 p-1 rounded-full">
          {items.map((item, index) => {
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
                    ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                    : "text-zinc-500 hover:text-zinc-900",
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
