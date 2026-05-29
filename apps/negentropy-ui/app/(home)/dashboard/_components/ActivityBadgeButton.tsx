"use client";

import { Activity } from "lucide-react";

interface ActivityBadgeButtonProps {
  count: number;
  onClick: () => void;
}

export function ActivityBadgeButton({ count, onClick }: ActivityBadgeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted/50"
      aria-label={`Activity log (${count} entries)`}
    >
      <Activity className="h-4 w-4 text-muted-foreground" />
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
