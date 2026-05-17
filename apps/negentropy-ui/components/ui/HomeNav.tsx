"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useNavigation } from "@/components/providers/NavigationProvider";

const NAV_ITEMS = [
  { key: "studio", href: "/studio", label: "Studio" },
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
];

/**
 * Home 页 Studio | Dashboard 子页面切换。
 *
 * 设计取舍（与 [[MemoryNav]] 一致）：
 * - rounded-full 胶囊样式，复用 muted/50 背景与 foreground 高亮模式；
 * - sessionId 仅 Studio 携带（Plan §3 确认），切换到 Dashboard 时丢弃。
 *   反向（Dashboard → Studio）也不主动恢复 sessionId，避免历史串扰；
 *   Studio 内部仍由 useSearchParams 自然派生 ?sessionId=。
 */
export function HomeNav({ title }: { title: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setNavigationInfo } = useNavigation();

  useEffect(() => {
    setNavigationInfo({ moduleLabel: "Home", pageTitle: title });
    return () => setNavigationInfo(null);
  }, [title, setNavigationInfo]);

  const isActive = (href: string) =>
    href === "/studio" ? pathname.startsWith("/studio") : pathname.startsWith(href);

  // Studio Tab 保留 sessionId（用户在 Dashboard <-> Studio 切换时不丢失会话）
  const sessionId = searchParams?.get("sessionId");
  const studioHref = sessionId ? `/studio?sessionId=${encodeURIComponent(sessionId)}` : "/studio";

  return (
    <div className="border-b border-border bg-card px-6 py-1">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-full">
          {NAV_ITEMS.map((item) => {
            const href = item.key === "studio" ? studioHref : item.href;
            return (
              <Link
                key={item.key}
                href={href}
                className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
                  isActive(item.href)
                    ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
