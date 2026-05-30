"use client";

import Image from "next/image";
import Link from "next/link";
import { MainNav } from "./MainNav";
import { UserNav } from "./UserNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { mainNavConfig } from "@/config/navigation";
import { useNavigation } from "@/components/providers/NavigationProvider";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  const { navigationInfo } = useNavigation();

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-card/85 px-6 py-2 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Brand + Location */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-0">
            <Image
              src="/logo.svg"
              alt="Negentropy"
              width={48}
              height={24}
              className="h-6 w-12 object-contain"
            />
            <span className="text-sm font-bold tracking-overline text-foreground">
              Negentropy
            </span>
          </Link>

          {/* Location breadcrumb from secondary nav */}
          {navigationInfo && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="text-text-muted">{navigationInfo.moduleLabel}</span>
              <span className="text-text-muted/50">/</span>
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
          <div className="mx-2 hidden h-4 w-px bg-border sm:block"></div>
          <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </div>
  );
}
