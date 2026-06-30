"use client";

interface MemorySidebarLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  /**
   * 可选：主内容区滚动容器 ref。Facts 列表的无限滚动/翻页套件需引用真实的
   * `overflow-y-auto` 容器（即此 `<main>`）作为 IntersectionObserver root。
   * 纯增量、默认 undefined——既有调用方行为不变。
   */
  mainRef?: React.RefObject<HTMLElement | null>;
}

export function MemorySidebarLayout({
  children,
  sidebar,
  mainRef,
}: MemorySidebarLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <main ref={mainRef} className="min-h-0 min-w-0 flex-[3] overflow-y-auto">
        <div className="pb-4 pr-2">{children}</div>
      </main>
      <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="space-y-4 pb-4 pr-2">{sidebar}</div>
      </aside>
    </div>
  );
}
