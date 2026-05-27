"use client";

import { cn } from "@/lib/utils";

interface SidebarCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function SidebarCard({ title, children, className }: SidebarCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
    >
      <h2 className="text-xs font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}
