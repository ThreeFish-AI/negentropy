"use client";

import { useActivityLog, type ActivityLevel } from "@/hooks/useActivityLog";
import { outlineButtonClassName } from "@/components/ui/button-styles";

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

export function ActivityLogPanel() {
  const { entries, levelFilter, setLevelFilter, reload, clear, totalCount } =
    useActivityLog();

  return (
    <div
      data-testid="activity-log-panel"
      className="rounded-lg border border-border bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-wider text-muted">
          Activity
        </div>
        <nav className="ml-2 flex items-center gap-1 rounded-full bg-muted/50 p-0.5">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
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
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted">
            {entries.length}
            {levelFilter ? ` / ${totalCount}` : ""} entries
          </span>
          <button
            className={outlineButtonClassName(
              "neutral",
              "rounded-md px-2 py-1 text-[11px] font-semibold",
            )}
            onClick={reload}
          >
            Refresh
          </button>
          <button
            className={outlineButtonClassName(
              "danger",
              "rounded-md px-2 py-1 text-[11px] font-semibold",
            )}
            onClick={clear}
          >
            Clear All
          </button>
        </div>
      </div>
      <div className="max-h-[480px] overflow-auto p-3">
        {entries.length ? (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 shadow-sm"
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
                    <span className="text-[11px] text-muted">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-foreground">
                    {entry.message}
                  </p>
                  {entry.description ? (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {entry.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-3 py-6 text-center text-xs text-muted">
            No activity recorded yet. Toast notifications will appear here as
            they occur across the platform.
          </div>
        )}
      </div>
    </div>
  );
}
