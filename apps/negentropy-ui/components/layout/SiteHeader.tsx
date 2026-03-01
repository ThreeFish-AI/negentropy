"use client";

import Link from "next/link";
import { MainNav } from "./MainNav";
import { UserNav } from "./UserNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { mainNavConfig } from "@/config/navigation";
import { useNavigation } from "@/components/providers/NavigationProvider";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  const { navigationInfo } = useNavigation();

  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-2 sticky top-0 z-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Brand + Location */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-0">
            <img
              src="/logo.svg"
              alt="Negentropy"
              className="h-6 w-12 object-contain"
            />
            <span className="text-sm font-bold tracking-[0.1em] text-black dark:text-white">
              Negentropy
            </span>
          </Link>

          {/* Location breadcrumb from secondary nav */}
          {navigationInfo && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">
                {navigationInfo.moduleLabel}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <span className="font-semibold text-foreground">
                {navigationInfo.pageTitle}
              </span>
            </div>
          )}
        </div>

        {/* User Area and Actions */}
        <div className="flex items-center gap-3 text-sm">
          <MainNav items={mainNavConfig} />
          {children}
          <div className="h-4 w-px bg-zinc-200 mx-2 hidden sm:block dark:bg-zinc-700"></div>
          <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </div>
  );
}
