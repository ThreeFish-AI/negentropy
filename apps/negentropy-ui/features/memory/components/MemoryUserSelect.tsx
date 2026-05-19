"use client";

import { cn } from "@/lib/utils";

interface MemoryUserSelectProps {
  users: Array<{ id: string; label?: string; name?: string }>;
  selectedUserId: string | null;
  onSelect: (userId: string | null) => void;
  loading?: boolean;
  allowAll?: boolean;
  allLabel?: string;
  className?: string;
}

export function MemoryUserSelect({
  users,
  selectedUserId,
  onSelect,
  loading,
  allowAll = true,
  allLabel = "全部用户",
  className,
}: MemoryUserSelectProps) {
  return (
    <select
      aria-label="Filter by user"
      className={cn(
        "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs w-64 dark:border-zinc-700 dark:bg-zinc-800",
        className,
      )}
      value={selectedUserId ?? ""}
      onChange={(e) => onSelect(e.target.value || null)}
    >
      {allowAll ? (
        <option value="">{loading ? "加载用户中..." : allLabel}</option>
      ) : (
        <option value="" disabled>
          {loading ? "加载中..." : "选择用户..."}
        </option>
      )}
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.label || u.name || u.id}
        </option>
      ))}
    </select>
  );
}
