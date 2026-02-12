"use client";

import Link from "next/link";
import { MainNav } from "./MainNav";
import { UserNav } from "./UserNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { mainNavConfig } from "@/config/navigation";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-4 sticky top-0 z-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-9">
          <Link href="/" className="flex items-center gap-0">
            <img
              src="/logo.svg"
              alt="Negentropy"
              className="h-9 w-16 object-contain"
            />
            <span className="text-[15px] font-bold tracking-[0.1em] text-black dark:text-white">
              Negentropy
            </span>
          </Link>
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
