"use client";

interface MemorySidebarLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export function MemorySidebarLayout({
  children,
  sidebar,
}: MemorySidebarLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <main className="min-h-0 min-w-0 flex-[3] overflow-y-auto">
        <div className="pb-4 pr-2">{children}</div>
      </main>
      <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="space-y-4 pb-4 pr-2">{sidebar}</div>
      </aside>
    </div>
  );
}
