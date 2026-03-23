"use client";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { useActivityLog } from "@/features/memory";
import type { ActivityLevel } from "@/features/memory";

const LEVEL_OPTIONS: { value: ActivityLevel | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
];

const LEVEL_DOT: Record<ActivityLevel, string> = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
};

const LEVEL_BADGE: Record<ActivityLevel, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  error:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
};

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function MemoryActivityPage() {
  const { entries, levelFilter, setLevelFilter, reload, clear, totalCount } =
    useActivityLog();

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <MemoryNav
        title="Activity"
        description="平台活动日志"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="pb-6">
            {/* Toolbar */}
            <div className="mb-6 flex items-center gap-3">
              <nav className="flex items-center gap-1 rounded-full bg-muted/50 p-1">
                {LEVEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    className={`rounded-full px-4 py-1 text-xs font-semibold transition-colors ${
                      levelFilter === opt.value
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                    onClick={() => setLevelFilter(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </nav>
              <div className="flex-1" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {entries.length}
                {levelFilter ? ` / ${totalCount}` : ""} entries
              </span>
              <button
                className={outlineButtonClassName(
                  "neutral",
                  "rounded-lg px-3 py-2 text-xs font-semibold",
                )}
                onClick={reload}
              >
                Refresh
              </button>
              <button
                className={outlineButtonClassName(
                  "danger",
                  "rounded-lg px-3 py-2 text-xs font-semibold",
                )}
                onClick={clear}
              >
                Clear All
              </button>
            </div>

            {/* Activity Feed */}
            {entries.length ? (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[entry.level]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LEVEL_BADGE[entry.level]}`}
                        >
                          {entry.level}
                        </span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        {entry.message}
                      </p>
                      {entry.description && (
                        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No activity recorded yet. Toast notifications will appear
                  here as they occur across the platform.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
