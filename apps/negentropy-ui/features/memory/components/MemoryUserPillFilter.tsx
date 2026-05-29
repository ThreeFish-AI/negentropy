"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Pill button
// ---------------------------------------------------------------------------

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
        active
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MemoryUserPillFilter
// ---------------------------------------------------------------------------

const MAX_VISIBLE_USERS = 10;

interface MemoryUserPillFilterProps {
  users: Array<{ id: string; label?: string; name?: string }>;
  activeUserId: string | null;
  onSelect: (userId: string | null) => void;
  loading?: boolean;
  maxVisible?: number;
  allLabel?: string;
}

export function MemoryUserPillFilter({
  users,
  activeUserId,
  onSelect,
  loading,
  maxVisible = MAX_VISIBLE_USERS,
  allLabel = "All Users",
}: MemoryUserPillFilterProps) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-16 animate-pulse rounded-full bg-muted/40"
          />
        ))}
      </div>
    );
  }

  const visibleUsers = users.slice(0, maxVisible);
  const hiddenCount = users.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1.5">
      <Pill active={activeUserId === null} onClick={() => onSelect(null)}>
        {allLabel}
      </Pill>
      {visibleUsers.map((u) => (
        <Pill
          key={u.id}
          active={activeUserId === u.id}
          onClick={() => onSelect(u.id)}
        >
          {u.label || u.name || u.id}
        </Pill>
      ))}
      {hiddenCount > 0 && (
        <span className="rounded-full px-3 py-1 text-xs text-muted-foreground border border-dashed border-border">
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}
