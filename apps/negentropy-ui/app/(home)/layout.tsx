import { Suspense, type ReactNode } from "react";

import { HomeNav } from "@/components/ui/HomeNav";

/**
 * Home 路由组 layout（Studio + Dashboard 共享）。
 *
 * 设计动机（Plan §3 方案 A 嵌套段路由）：
 * - 用 ``(home)`` route group 隔离 Studio / Dashboard 子页面，URL 上不带 ``/home`` 前缀；
 * - 顶部统一 HomeNav 提供 Tab 切换；
 * - HomeNav 内部使用 useSearchParams，故需 Suspense 兜底以满足 Next.js 16 SSG CSR
 *   bailout 要求（与 ``app/page.tsx`` 处理 useSearchParams 的方式对齐）。
 */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Suspense
        fallback={
          <div className="border-b border-border bg-card px-6 py-1">
            <div className="flex h-7 items-center justify-end" />
          </div>
        }
      >
        <HomeNav />
      </Suspense>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
